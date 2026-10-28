// v2 payout worker: refunds expired tasks, then sends one split payout or refund transaction
// per task (ADR 0024). The tick is at most 5 s, so expiry is refunded within one tick (ADR 0028).

import { sweepExpired } from "./decide.js";
import { taskLedger } from "./ledger.js";
import { createLoop } from "./loop.js";
import type { TaskPayoutDeps } from "./taskTypes.js";
import type { Worker } from "./types.js";

const MAX_INTERVAL_MS = 5_000;

export const createTaskWorker = (
	deps: TaskPayoutDeps,
	intervalMs = 2_000,
): Worker =>
	createLoop({
		send: {
			ledger: taskLedger(deps.database),
			chain: deps.chain,
			sign: (transfer) =>
				deps.chain.signPayout({
					legs: transfer.legs.map((leg) => ({
						ownerWallet: leg.wallet,
						amountUnits: leg.units,
					})),
					memo: transfer.memo,
				}),
			describe: (transfer) =>
				`${transfer.kind} task ${transfer.taskId} memo ${transfer.memo}`,
			maxAttempts: deps.maxAttempts,
			now: deps.now,
			log: deps.log,
		},
		preflightProblems: deps.preflightProblems,
		decide: () => {
			for (const memo of sweepExpired(deps)) {
				deps.log(`decided refund ${memo}`);
			}
		},
		intervalMs: Math.min(intervalMs, MAX_INTERVAL_MS),
	});
