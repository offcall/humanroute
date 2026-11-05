// Jobs overview numbers from GET /api/orders. Pure.
import { type Order, type Task, TaskState } from "../shared";

export type Summary = {
	escrowUnits: bigint;
	running: number;
	paidTodayUnits: bigint;
	refundedTodayUnits: bigint;
	toReview: Task[];
};

const SETTLED = new Set(["paid_out", "refunded"]);
const UNDECIDED = new Set([
	TaskState.Open,
	TaskState.Claimed,
	TaskState.Submitted,
]);

const sameLocalDay = (iso: string, now: number): boolean =>
	new Date(iso).toDateString() === new Date(now).toDateString();

const settledToday = (task: Task, publicState: string, now: number) =>
	task.publicState === publicState &&
	task.transfer?.confirmedAt != null &&
	sameLocalDay(task.transfer.confirmedAt, now);

const sum = (tasks: Task[]): bigint =>
	tasks.reduce((total, task) => total + task.priceUnits, 0n);

// now: server time in ms; "today" is the local day of it.
export const summaryOf = (orders: Order[], now: number): Summary => {
	const tasks = orders.flatMap((order) => order.tasks);

	return {
		escrowUnits: sum(tasks.filter((task) => !SETTLED.has(task.publicState))),
		running: tasks.filter((task) => UNDECIDED.has(task.state)).length,
		paidTodayUnits: sum(
			tasks.filter((task) => settledToday(task, "paid_out", now)),
		),
		refundedTodayUnits: sum(
			tasks.filter((task) => settledToday(task, "refunded", now)),
		),
		toReview: tasks.filter((task) => task.state === TaskState.Submitted),
	};
};
