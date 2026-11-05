// Parses the gateway's auto-pay answers (ADR 0036) without trusting their shape.
import { formatUsdc } from "./money.js";
import type { PaidOrder, PayResult, Unsigned } from "./payTypes.js";
import { PayOutcome } from "./payTypes.js";
import type { Parsed } from "./types.js";

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
			return "draft not found or expired: call post_task again";
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
