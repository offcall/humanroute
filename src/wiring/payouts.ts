// Payout deps: the only place that moves money is src/payouts (AGENTS.md chain safety).
import type { TaskPayoutDeps } from "../payouts/index.js";
import type { WiringInput } from "./types.js";

const MAX_TRANSFER_ATTEMPTS = 10;

export const payoutDeps = (input: WiringInput): TaskPayoutDeps => {
	const { config } = input;
	return {
		database: input.database,
		chain: input.chain,
		shares: {
			agencyBps: config.agencyShareBps,
			feeBps: config.feeShareBps,
			feeWallet: config.feeWallet,
		},
		maxAttempts: MAX_TRANSFER_ATTEMPTS,
		preflightProblems: input.preflightProblems,
		now: input.now,
		newId: input.newId,
		log: input.log("payouts"),
	};
};
