// Startup helpers. Preflight watch: a failing check never stops the process. /x/translate answers 503 with the
// reasons until a re-check every interval passes again (ADR 0008).
import type { PreflightProblem } from "./config/index.js";

export const log = (scope: string) => (msg: string) =>
	console.log(`[${scope}] ${msg}`);

// Explicit type so callers narrow after exit(); an inferred arrow type does not.
export const exit: (title: string, problems: string[]) => never = (
	title,
	problems,
) => {
	console.error(`humanroute: ${title}`);
	for (const problem of problems) {
		console.error(`  - ${problem}`);
	}
	process.exit(1);
};

export type PreflightWatch = { problems: () => string[]; stop: () => void };

type Check = () => Promise<PreflightProblem[]>;

const safeCheck = (check: Check): Promise<PreflightProblem[]> =>
	check().catch((err: unknown) => [
		{
			reason: "preflight check threw",
			detail: `preflight check threw: ${err instanceof Error ? err.message : String(err)}`,
		},
	]);

// Full details (may name URLs) go to the log; problems() exposes only the public reasons.
const details = (found: PreflightProblem[]): string =>
	found.map((problem) => problem.detail).join("; ");

export const watchPreflight = async (
	check: Check,
	log: (msg: string) => void,
	intervalMs: number,
): Promise<PreflightWatch> => {
	let current = await safeCheck(check);
	if (current.length > 0) {
		log(`failed, not taking payments: ${details(current)}`);
	}

	const timer = setInterval(() => {
		safeCheck(check).then((found) => {
			if (found.length > 0 || current.length > 0) {
				log(found.length > 0 ? details(found) : "ok again");
			}
			current = found;
		});
	}, intervalMs);

	return {
		problems: () => current.map((problem) => problem.reason),
		stop: () => clearInterval(timer),
	};
};
