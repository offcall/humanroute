import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import type { ClientSvmSigner } from "@x402/svm";
import { SOLANA_DEVNET_CAIP2 } from "@x402/svm";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { parsePayResult } from "./parse";
import { paymentFailureReason } from "./reason";
import type { Parsed, PayResult } from "./types";

const errorByCode: Record<string, string> = {
	draft_paid: "this draft was already paid with another payment",
	payment_reused: "this payment was already used for another draft",
	orphan_payment: "payment settled but was not recorded, contact support",
	not_ready: "the gateway is not ready, try again later",
};

const readError = async (response: Response): Promise<string> => {
	const body: unknown = await response.json().catch(() => undefined);
	const code =
		typeof body === "object" && body !== null ? Reflect.get(body, "error") : "";
	const known = typeof code === "string" ? errorByCode[code] : undefined;
	if (known !== undefined) {
		return known;
	}
	if (response.status === 404) {
		return "draft not found or expired";
	}
	if (response.status === 502) {
		return "facilitator or chain error, try again later";
	}
	if (response.status === 503) {
		return "the gateway is not ready, try again later";
	}
	const reason = paymentFailureReason(response.headers);
	if (reason !== undefined) {
		return `payment failed (HTTP ${response.status}): ${reason}`;
	}

	return `payment failed (HTTP ${response.status})`;
};

export const payOrder = async (input: {
	draftId: string;
	totalUnits: bigint;
	signer: ClientSvmSigner;
}): Promise<Parsed<PayResult>> => {
	const client = new x402Client()
		.register(SOLANA_DEVNET_CAIP2, new ExactSvmScheme(input.signer))
		// The default $1 cap would reject orders above 1 USDC; the policy below caps the amount exactly.
		.setSpendControls(false)
		.registerPolicy((_version, requirements) =>
			requirements.filter((req) => req.amount === input.totalUnits.toString()),
		);
	const payingFetch = wrapFetchWithPayment(fetch, client);

	let response: Response;
	try {
		response = await payingFetch(
			`/x/orders/${encodeURIComponent(input.draftId)}`,
			{ method: "POST" },
		);
	} catch (error) {
		const reason = error instanceof Error ? error.message : "unknown error";

		return { ok: false, error: `payment aborted: ${reason}` };
	}
	if (response.status !== 201) {
		return { ok: false, error: await readError(response) };
	}

	// After HTTP 201 the payment has settled: an unreadable result must not look like a failed payment.
	const body: unknown = await response.json().catch(() => undefined);
	const parsed = parsePayResult(body);
	if (!parsed.ok) {
		return {
			ok: false,
			error:
				"payment settled, but the order result could not be read; reload the draft page",
		};
	}

	return parsed;
};
