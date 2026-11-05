// Real clock for wait_task; wait.ts takes it as WaitDeps.
import type { WaitDeps } from "./types.js";

const sleep = (millis: number, signal: AbortSignal): Promise<void> =>
	new Promise((resolve) => {
		if (signal.aborted) {
			resolve();
			return;
		}
		const wake = () => {
			clearTimeout(timer);
			signal.removeEventListener("abort", wake);
			resolve();
		};
		const timer = setTimeout(wake, millis);
		signal.addEventListener("abort", wake, { once: true });
	});

export const systemClock: WaitDeps = { now: Date.now, sleep };
