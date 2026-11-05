// Auto-pay checks before a delegate payment is built (ADR 0036): token account, delegate,
// allowance and balance, so the agent gets a clear reason instead of a simulation error.
import type { FirmTokenAccount } from "./types.js";

export const CHAIN_DOWN = { error: "chain_unavailable" };

export type AutopayRefusal = {
	error:
		| "no_usdc_account"
		| "autopay_off"
		| "autopay_limit"
		| "insufficient_usdc";
	detail: Record<string, string>;
};

export type AutopayReady =
	| { ok: true; delegate: string }
	| { ok: false; refusal: AutopayRefusal };

export const checkAutopay = (
	account: FirmTokenAccount,
	totalUnits: bigint,
): AutopayReady => {
	if (!account.exists) {
		return {
			ok: false,
			refusal: {
				error: "no_usdc_account",
				detail: { account: account.address },
			},
		};
	}
	if (account.delegate === null || account.delegatedAmount === 0n) {
		return { ok: false, refusal: { error: "autopay_off", detail: {} } };
	}
	if (account.delegatedAmount < totalUnits) {
		const leftUnits = account.delegatedAmount.toString();
		return {
			ok: false,
			refusal: { error: "autopay_limit", detail: { leftUnits } },
		};
	}
	if (account.amount < totalUnits) {
		const balanceUnits = account.amount.toString();
		return {
			ok: false,
			refusal: { error: "insufficient_usdc", detail: { balanceUnits } },
		};
	}

	return { ok: true, delegate: account.delegate };
};
