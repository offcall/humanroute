// wait_task core: poll until the draft's fingerprint changes (ADR 0031).
import { renderStatus } from "./render.js";
import { fingerprint, isSettled, progressLine } from "./status.js";
import {
	type DraftStatus,
	type Parsed,
	type Snapshot,
	type WaitDeps,
	WaitKind,
	type WaitOutcome,
} from "./types.js";

const POLL_MS = 2000;
const PROGRESS_MS = 30_000;
export const CAP_MS = 3_600_000;
// Failed reads in a row before giving up: about 30 s, enough for a gateway redeploy.
const MAX_FAILURES = 15;

type WaitInput = {
	read: (paid: DraftStatus | undefined) => Promise<Parsed<Snapshot>>;
	seen: string | undefined;
	signal: AbortSignal;
	report: (message: string) => Promise<void>;
	deps: WaitDeps;
};

const answer = (
	kind: WaitKind.Changed | WaitKind.Settled | WaitKind.Cap,
	snapshot: Snapshot,
): WaitOutcome => ({
	kind,
	text: renderStatus(snapshot.status, snapshot.order),
	seen: fingerprint(snapshot),
});

export const waitForChange = async ({
	read,
	seen,
	signal,
	report,
	deps,
}: WaitInput): Promise<WaitOutcome> => {
	const started = deps.now();
	let baseline = seen;
	let paid: DraftStatus | undefined;
	let failures = 0;
	let reportedAt = started;

	while (!signal.aborted) {
		const current = await read(paid);
		if (!current.ok) {
			failures += 1;
			if (failures >= MAX_FAILURES) {
				return { kind: WaitKind.Error, message: current.error, seen: baseline };
			}
			await deps.sleep(POLL_MS, signal);
			continue;
		}
		failures = 0;
		const snapshot = current.value;
		if (snapshot.order !== undefined) {
			paid = snapshot.status;
		}
		const print = fingerprint(snapshot);
		if (isSettled(snapshot.order)) {
			return answer(WaitKind.Settled, snapshot);
		}
		if (baseline !== undefined && print !== baseline) {
			return answer(WaitKind.Changed, snapshot);
		}
		baseline = print;

		const now = deps.now();
		if (now - started >= CAP_MS) {
			return answer(WaitKind.Cap, snapshot);
		}
		if (now - reportedAt >= PROGRESS_MS) {
			await report(progressLine(snapshot));
			reportedAt = now;
		}
		await deps.sleep(POLL_MS, signal);
	}

	return { kind: WaitKind.Aborted };
};
