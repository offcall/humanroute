// Teardown stack of one run: runs in reverse order once, on normal end, SIGINT or SIGTERM.
type Step = () => Promise<void> | void;

export type Cleanup = { add: (step: Step) => void; run: () => Promise<void> };

export const createCleanup = (): Cleanup => {
	const steps: Step[] = [];
	let done: Promise<void> | undefined;

	const run = (): Promise<void> => {
		done ??= (async () => {
			for (const step of steps.reverse()) {
				try {
					await step();
				} catch (error) {
					console.error(`e2e cleanup step failed: ${String(error)}`);
				}
			}
		})();
		return done;
	};

	const onSignal = (signal: NodeJS.Signals): void => {
		run().finally(() => process.kill(process.pid, signal));
	};
	process.once("SIGINT", onSignal);
	process.once("SIGTERM", onSignal);

	return {
		add: (step) => {
			steps.push(step);
		},
		run: async () => {
			process.off("SIGINT", onSignal);
			process.off("SIGTERM", onSignal);
			await run();
		},
	};
};
