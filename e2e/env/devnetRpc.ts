// Devnet only: the public RPC answers 429 under load. Retries a call with a growing pause and
// paces sends, so a run does not stop half-way through funding or sweeping.
const ATTEMPTS = 8;
const FIRST_PAUSE_MS = 2_000;
const PACE_MS = 1_000;

const pause = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimit = (error: unknown): boolean => String(error).includes("429");

export const withRetry = async <T = unknown>(
	what: string,
	call: () => Promise<T>,
): Promise<T> => {
	for (let attempt = 1; ; attempt += 1) {
		try {
			const result = await call();
			await pause(PACE_MS);
			return result;
		} catch (error) {
			if (!isRateLimit(error) || attempt >= ATTEMPTS) {
				throw new Error(`${what}: ${String(error)}`);
			}
			await pause(FIRST_PAUSE_MS * 2 ** (attempt - 1));
		}
	}
};
