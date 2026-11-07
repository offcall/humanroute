// Fake x402 facilitator without network. getSupported carries extra.feePayer, which the x402
// middleware reads when it starts; verify and settle succeed unless a test replaces `answer`.
import type { FacilitatorClient } from "@x402/core/server";
import type { Network } from "../config/index.js";

export type FakeFacilitator = FacilitatorClient & {
	answer: FacilitatorClient;
	calls: { verify: number; settle: number };
};

export const fakeFacilitator = (
	network: Network,
	feePayer: string,
	payer: string,
): FakeFacilitator => {
	const calls = { verify: 0, settle: 0 };
	let settled = 0;
	const answer: FacilitatorClient = {
		getSupported: async () => ({
			kinds: [
				{ x402Version: 2, scheme: "exact", network, extra: { feePayer } },
			],
			extensions: [],
			signers: {},
		}),
		verify: async () => ({ isValid: true, payer }),
		settle: async () => {
			settled += 1;
			return {
				success: true,
				transaction: `pay-tx-${settled}`,
				network,
				payer,
			};
		},
	};

	return {
		answer,
		calls,
		getSupported: () => answer.getSupported(),
		verify: (payload, requirements) => {
			calls.verify += 1;
			return answer.verify(payload, requirements);
		},
		settle: (payload, requirements) => {
			calls.settle += 1;
			return answer.settle(payload, requirements);
		},
	};
};
