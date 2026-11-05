// wait_task core: poll until the draft's fingerprint changes (ADR 0031).
import { renderStatus } from "./render.js";
import {
	changesSince,
	fingerprint,
	isSettled,
	onlyTransient,
	progressLine,
} from "./status.js";
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
// How long reads may keep failing before giving up; enough for a gateway redeploy.
const FAILING_MS = 30_000;

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
	changes: string[],
): WaitOutcome => ({
	kind,
	text: [
		`changes: ${changes.length === 0 ? "none" : changes.join("; ")}`,
		renderStatus(snapshot.status, snapshot.order),
	].join("\n"),
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
	let failingSince: number | undefined;
	let line = "waiting";
	let reportedAt = started;

	while (!signal.aborted) {
		const readAt = deps.now();
		const current = await read(paid);
		if (current.ok) {
			failingSince = undefined;
			const snapshot = current.value;
			if (snapshot.order !== undefined) {
				paid = snapshot.status;
			}
			const print = fingerprint(snapshot);
			const changes =
				baseline === undefined ? [] : changesSince(baseline, snapshot);
			if (isSettled(snapshot.order)) {
				return answer(WaitKind.Settled, snapshot, changes);
			}
			if (
				baseline !== undefined &&
				print !== baseline &&
				!onlyTransient(changes)
			) {
				return answer(WaitKind.Changed, snapshot, changes);
			}
			baseline = print;
			line = progressLine(snapshot);
			if (deps.now() - started >= CAP_MS) {
				return answer(WaitKind.Cap, snapshot, changes);
			}
		} else {
			failingSince = failingSince ?? readAt;
			if (current.permanent || deps.now() - failingSince >= FAILING_MS) {
				return { kind: WaitKind.Error, message: current.error, seen: baseline };
			}
			line = "gateway not answering, retrying";
		}

		const now = deps.now();
		if (now - reportedAt >= PROGRESS_MS) {
			await report(line);
			reportedAt = now;
		}
		await deps.sleep(POLL_MS, signal);
	}

	return { kind: WaitKind.Aborted };
};
