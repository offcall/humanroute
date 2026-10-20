// Builds the x402 paying fetch for the agent, ported from spike/client.ts (verified on devnet).
// No mint is hardcoded: the agent pays in whatever asset the 402 requirements name, but only on
// Solana devnet and only up to MAX_PAYMENT_ATOMIC base units per payment.
import type { KeyPairSigner } from "@solana/kit";
import { type PaymentPolicy, x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactSvmScheme } from "@x402/svm/exact/client";

const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
/** 0.50 of a 6-decimal token. */
export const MAX_PAYMENT_ATOMIC = 500_000n;

const parseAtomic = (amount: string): bigint | undefined =>
	/^\d+$/.test(amount) ? BigInt(amount) : undefined;

// Non-default assets (e.g. a fallback test mint) have no USD cap, so cap them here in base units.
const capAmount: PaymentPolicy = (_version, requirements) =>
	requirements.filter((requirement) => {
		const amount = parseAtomic(requirement.amount);
		return amount !== undefined && amount <= MAX_PAYMENT_ATOMIC;
	});

export const payingFetch = (
	signer: KeyPairSigner,
): ReturnType<typeof wrapFetchWithPayment> => {
	const client = x402Client.fromConfig({
		schemes: [{ network: SOLANA_DEVNET, client: new ExactSvmScheme(signer) }],
		policies: [capAmount],
		spendControls: { allowedAssets: true },
	});
	return wrapFetchWithPayment(fetch, client);
};
