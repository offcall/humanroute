// Parses the gateway's auto-pay answers (ADR 0036) without trusting their shape.
import { formatUsdc } from "./money.js";
import type { PaidOrder, PayResult, Unsigned } from "./payTypes.js";
import { PayOutcome } from "./payTypes.js";
import type { Parsed } from "./types.js";

// Verify plus settle through the facilitator can take longer than a plain read.
export const PAY_TIMEOUT_MS = 45_000;
// No answer, a broken connection or a 5xx after sending: the payment may have settled, even as an
// orphan. No automatic second payment; the user decides.
export const payUnknown = (reason: string) =>
	`${reason}; the payment may have settled. Call get_task. If it shows no order, tell the user the outcome is unknown and ask before calling prepare_payment or pay_task again`;

export const STILL_SETTLING =
	"the payment is still settling: call get_task in a few seconds; do not call prepare_payment";

// Settled but not recorded (ADR 0016): another payment would charge the firm twice.
export const orphanText = (payTx: string | undefined) =>
	`the money was taken (payTx ${payTx ?? "unknown"}) but no order was recorded. Do NOT pay again: tell the user; the operator refunds it by hand`;

const stringOf = (body: unknown, key: string): string | undefined => {
	const value =
		typeof body === "object" && body !== null
			? Reflect.get(body, key)
			: undefined;
	return typeof value === "string" && value !== "" ? value : undefined;
};

const units = (value: string | undefined): string =>
	value !== undefined && /^\d+$/.test(value)
		? formatUsdc(value)
		: "an unknown amount";

// The firm fixes these in the cabinet or pays by link; the gateway checked them before building.
const refusal = (code: string | undefined, body: unknown): string => {
	switch (code) {
		case "autopay_off":
			return "auto-pay is off for this firm: enable it in the firm cabinet, or pay by link";
		case "autopay_limit":
			return `auto-pay limit is too low (${units(stringOf(body, "leftUnits"))} left): raise it in the firm cabinet, or pay by link`;
		case "insufficient_usdc":
			return `the firm wallet has only ${units(stringOf(body, "balanceUnits"))}: top it up, or pay by link`;
		case "no_usdc_account":
			return "the firm wallet has no USDC account yet: receive USDC first, or pay by link";
		case "draft_paid":
			return "this draft is already paid: call get_task";
		case "not_found":
			return "draft not found or expired: tell the user; do not wait again or create a new draft automatically";
		default:
			return `gateway refused: ${code ?? "unknown error"}`;
	}
};

export const parseUnsigned = (
	status: number,
	body: unknown,
): Parsed<Unsigned> => {
	if (status !== 200) {
		return { ok: false, error: refusal(stringOf(body, "error"), body) };
	}
	const transaction = stringOf(body, "transaction");
	const message = stringOf(body, "message");
	const signer = stringOf(body, "signer");
	const amountUnits = stringOf(body, "amountUnits");
	if (amountUnits !== undefined && !/^\d+$/.test(amountUnits)) {
		return { ok: false, error: "gateway sent an unreadable amount" };
	}
	const payTo = stringOf(body, "payTo");
	if (!transaction || !message || !signer || !amountUnits || !payTo) {
		return { ok: false, error: "gateway sent an unreadable unsigned payment" };
	}
	return {
		ok: true,
		value: { transaction, message, signer, amountUnits, payTo },
	};
};

export const parsePaid = (body: unknown): Parsed<PayResult> => {
	const orderId = stringOf(body, "orderId");
	const payTx = stringOf(body, "payTx");
	if (!orderId || !payTx) {
		return {
			ok: false,
			error: "payment settled, but the order could not be read: call get_task",
		};
	}
	const order: PaidOrder = { orderId, payTx };
	return { ok: true, value: { outcome: PayOutcome.Paid, order } };
};
