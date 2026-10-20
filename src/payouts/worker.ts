// Payout worker: every tick sweeps decisions, sends due pending transfers, then checks sent ones.
// Startup resolves in-flight (sent) transfers before anything new is decided or sent.
import { sweep } from "../jobs/index.js";
import { TransferStatus } from "../store/index.js";
import { checkSent, recoverSent } from "./recover.js";
import { isDue, sendPending } from "./send.js";
import type { PayoutDeps, Worker } from "./types.js";

export const createWorker = (deps: PayoutDeps, intervalMs = 2_000): Worker => {
	let timer: ReturnType<typeof setInterval> | null = null;
	let busy = false;
	let paused = false;

	// Logs once per transition; while paused nothing is sent or checked, so no attempt is counted.
	const isPaused = (): boolean => {
		const failing = deps.preflightProblems().length > 0;
		if (failing !== paused) {
			deps.log(
				failing ? "payouts paused: preflight failing" : "payouts resumed",
			);
		}
		paused = failing;
		return failing;
	};

	const exclusive = async (work: () => Promise<void>): Promise<void> => {
		if (busy) {
			return;
		}
		busy = true;
		try {
			await work();
		} finally {
			busy = false;
		}
	};

	const step = async (): Promise<void> => {
		const now = deps.now();
		for (const decided of sweep(deps.store, deps.terms, now, deps.newId)) {
			deps.log(
				`decided ${decided.kind} for job ${decided.jobId}: ${decided.amount} to ${decided.toWallet}`,
			);
		}
		if (isPaused()) {
			return;
		}
		const { transfers } = deps.store;
		for (const transfer of transfers.listByStatus(TransferStatus.Pending)) {
			if (isDue(transfer, now)) {
				await sendPending(deps, transfer);
			}
		}
		for (const transfer of transfers.listByStatus(TransferStatus.Sent)) {
			await checkSent(deps, transfer);
		}
	};

	const tick = () => exclusive(step);

	return {
		tick,
		start: async () => {
			if (!isPaused()) {
				await exclusive(() => recoverSent(deps));
			}
			timer = setInterval(() => {
				tick().catch((err: unknown) =>
					deps.log(
						`tick error: ${err instanceof Error ? err.message : String(err)}`,
					),
				);
			}, intervalMs);
		},
		stop: () => {
			if (timer) {
				clearInterval(timer);
			}
			timer = null;
		},
	};
};
