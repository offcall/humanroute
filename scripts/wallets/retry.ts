// Retries flaky devnet RPC calls with exponential backoff (2 s, 4 s, 8 s, ...).
const sleep = (delayMs: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, delayMs));

export const errorMessage = (err: unknown): string =>
	err instanceof Error ? err.message : String(err);

export const retry = async <T = unknown>(
	label: string,
	work: () => Promise<T>,
	tries = 5,
): Promise<T> => {
	let delay = 2000;
	for (let attempt = 1; ; attempt++) {
		try {
			return await work();
		} catch (err) {
			console.warn(
				`${label} failed (attempt ${attempt}/${tries}): ${errorMessage(err)}`,
			);
			if (attempt >= tries) {
				throw err;
			}
			await sleep(delay);
			delay *= 2;
		}
	}
};
