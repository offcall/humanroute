import { statusOf, TagKind, type Task, TaskState, toMs } from "../shared";

export type TaskGroups = {
	inProgress: Task[];
	waiting: Task[];
	doneToday: Task[];
	earlier: Task[];
};

const sameDay = (iso: string, now: number): boolean =>
	new Date(toMs(iso)).toDateString() === new Date(now).toDateString();

// Ended on the local day of `now`: the transfer was confirmed today.
export const doneToday = (task: Task, now: number): boolean => {
	const confirmedAt = task.transfer?.confirmedAt ?? null;

	return confirmedAt !== null && sameDay(confirmedAt, now);
};

const isFinal = (task: Task): boolean =>
	statusOf(task.state, task.publicState).final;

const byWorkDeadline = (left: Task, right: Task): number =>
	toMs(left.workDeadline ?? left.claimDeadline) -
	toMs(right.workDeadline ?? right.claimDeadline);

// In progress (soonest first) · Waiting for review or payout · Done today · Earlier
export const groupTasks = (tasks: Task[], now: number): TaskGroups => ({
	inProgress: tasks
		.filter((task) => task.state === TaskState.Claimed)
		.sort(byWorkDeadline),
	waiting: tasks.filter(
		(task) => task.state !== TaskState.Claimed && !isFinal(task),
	),
	doneToday: tasks.filter((task) => isFinal(task) && doneToday(task, now)),
	earlier: tasks.filter((task) => isFinal(task) && !doneToday(task, now)),
});

// The linguist's share of payouts confirmed today
export const todayUnits = (tasks: Task[], now: number): bigint =>
	tasks
		.filter((task) => doneToday(task, now))
		.reduce((sum, task) => sum + (task.transfer?.earnedUnits ?? 0n), 0n);

export const isPaid = (task: Task): boolean =>
	statusOf(task.state, task.publicState).tagKind === TagKind.Paid;

export const isLate = (task: Task): boolean =>
	task.state === TaskState.ExpiredLate;
