// Real clock for wait_task; wait.ts takes it as WaitDeps.
import type { WaitDeps } from "./types.js";

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
	new Promise((resolve) => {
		const wake = () => {
			clearTimeout(timer);
			signal.removeEventListener("abort", wake);
			resolve();
		};
		const timer = setTimeout(wake, ms);
		signal.addEventListener("abort", wake, { once: true });
	});

export const systemClock: WaitDeps = { now: Date.now, sleep };
