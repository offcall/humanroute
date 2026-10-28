// Worker loop shared by v1 jobs and v2 tasks: every tick records decisions, then (unless the
// preflight fails) sends due pending transfers and checks sent ones. Startup recovers sent rows.
import { TransferStatus } from "../store/index.js";
import { checkSent, recoverSent } from "./recover.js";
import { isDue, sendPending } from "./send.js";
import type { Sendable, SendDeps, Worker } from "./types.js";

export type LoopSpec<T extends Sendable = Sendable> = {
	send: SendDeps<T>;
	preflightProblems: () => string[];
	// Writes decisions and their pending transfers; runs even while paused.
	decide: () => void;
	intervalMs: number;
};

const drain = async <T extends Sendable = Sendable>(
	deps: SendDeps<T>,
): Promise<void> => {
	const now = deps.now();
	for (const transfer of deps.ledger.listByStatus(TransferStatus.Pending)) {
		if (isDue(transfer, now)) {
			await sendPending(deps, transfer);
		}
	}
	for (const transfer of deps.ledger.listByStatus(TransferStatus.Sent)) {
		await checkSent(deps, transfer);
	}
};

export const createLoop = <T extends Sendable = Sendable>(
	spec: LoopSpec<T>,
): Worker => {
	const { log } = spec.send;
	let timer: ReturnType<typeof setInterval> | null = null;
	let busy = false;
	let paused = false;

	// Logs once per transition; while paused nothing is sent or checked, so no attempt is counted.
	const isPaused = (): boolean => {
		const failing = spec.preflightProblems().length > 0;
		if (failing !== paused) {
			log(failing ? "payouts paused: preflight failing" : "payouts resumed");
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
		spec.decide();
		if (!isPaused()) {
			await drain(spec.send);
		}
	};

	const tick = () => exclusive(step);

	return {
		tick,
		start: async () => {
			if (!isPaused()) {
				await exclusive(() => recoverSent(spec.send));
			}
			timer = setInterval(() => {
				tick().catch((err: unknown) =>
					log(
						`tick error: ${err instanceof Error ? err.message : String(err)}`,
					),
				);
			}, spec.intervalMs);
		},
		stop: () => {
			if (timer) {
				clearInterval(timer);
			}
			timer = null;
		},
	};
};
