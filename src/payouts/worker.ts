// v1 payout worker: jobs sweep decisions, one-leg transfers from the v1 store (ADR 0003, 0005).
import { sweep } from "../jobs/index.js";
import type { Transfer } from "../store/index.js";
import { createLoop } from "./loop.js";
import type { PayoutDeps, Worker } from "./types.js";

export const createWorker = (deps: PayoutDeps, intervalMs = 2_000): Worker =>
	createLoop<Transfer>({
		send: {
			ledger: deps.store.transfers,
			chain: deps.chain,
			sign: (transfer) =>
				deps.chain.signTransfer({
					toWallet: transfer.toWallet,
					amount: transfer.amount,
					memo: transfer.memo,
				}),
			describe: (transfer) =>
				`${transfer.kind} ${transfer.amount} to ${transfer.toWallet} job ${transfer.jobId}`,
			maxAttempts: deps.maxAttempts,
			now: deps.now,
			log: deps.log,
		},
		preflightProblems: deps.preflightProblems,
		decide: () => {
			const now = deps.now();
			for (const decided of sweep(deps.store, deps.terms, now, deps.newId)) {
				deps.log(
					`decided ${decided.kind} for job ${decided.jobId}: ${decided.amount} to ${decided.toWallet}`,
				);
			}
		},
		intervalMs,
	});
