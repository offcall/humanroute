import { type BoardTask, toMs } from "../shared";

// What the board shows vs. what the last poll returned (ADR 0032: rows never move under the finger).
export type Snapshot = {
	shown: BoardTask[];
	latest: BoardTask[];
	// ids lost on a claim race (409)
	taken: string[];
	// server ms when each id first appeared; the drain bar starts there
	seenAt: Record<string, number>;
};

export enum RowKind {
	Open = "open",
	Taken = "taken",
	Closed = "closed",
}

export type BoardRow = { task: BoardTask; kind: RowKind; seenAt: number };

const byDeadline = (tasks: BoardTask[]): BoardTask[] =>
	[...tasks].sort(
		(left, right) => toMs(left.claimDeadline) - toMs(right.claimDeadline),
	);

const ids = (tasks: BoardTask[]): Set<string> =>
	new Set(tasks.map((task) => task.taskId));

const withSeen = (
	seenAt: Record<string, number>,
	tasks: BoardTask[],
	serverMs: number,
): Record<string, number> => {
	const next = { ...seenAt };
	for (const task of tasks) {
		next[task.taskId] ??= serverMs;
	}

	return next;
};

export const firstSnapshot = (
	tasks: BoardTask[],
	serverMs: number,
): Snapshot => ({
	shown: byDeadline(tasks),
	latest: tasks,
	taken: [],
	seenAt: withSeen({}, tasks, serverMs),
});

// A poll: keep the shown rows, remember the latest list.
export const withLatest = (
	snap: Snapshot,
	tasks: BoardTask[],
	serverMs: number,
): Snapshot => ({
	...snap,
	latest: tasks,
	seenAt: withSeen(snap.seenAt, tasks, serverMs),
});

// "Show", a successful claim or a pair save: the latest list becomes the board.
export const applyLatest = (snap: Snapshot): Snapshot => ({
	...snap,
	shown: byDeadline(snap.latest),
	taken: [],
});

export const markTaken = (snap: Snapshot, taskId: string): Snapshot => ({
	...snap,
	taken: [...snap.taken, taskId],
});

export const newCount = (snap: Snapshot): number => {
	const shownIds = ids(snap.shown);

	return snap.latest.filter((task) => !shownIds.has(task.taskId)).length;
};

// Vanished or lost ids read Taken (a heuristic: a pair edit also removes rows); expired read Closed.
export const rowsOf = (snap: Snapshot, now: number): BoardRow[] => {
	const latestIds = ids(snap.latest);

	return snap.shown.map((task) => {
		const seenAt = snap.seenAt[task.taskId] ?? now;
		if (toMs(task.claimDeadline) <= now) {
			return { task, kind: RowKind.Closed, seenAt };
		}
		const gone =
			!latestIds.has(task.taskId) || snap.taken.includes(task.taskId);

		return { task, kind: gone ? RowKind.Taken : RowKind.Open, seenAt };
	});
};

// No Open row on screen: nothing can move under the finger, so a poll may replace the list.
export const hasOpen = (snap: Snapshot, now: number): boolean =>
	rowsOf(snap, now).some((row) => row.kind === RowKind.Open);
