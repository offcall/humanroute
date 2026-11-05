// Jobs table order: your turn first, then running by deadline, money in flight, settled (newest first). Pure.
import { type Order, type Task, TaskState, toMs } from "../shared";

const SETTLED = new Set(["paid_out", "refunded"]);

const rank = (task: Task): number => {
	if (task.state === TaskState.Submitted) {
		return 0;
	}
	if (task.state === TaskState.Open || task.state === TaskState.Claimed) {
		return 1;
	}

	return SETTLED.has(task.publicState) ? 3 : 2;
};

// Running: the deadline that ends the current step; settled: confirmation time, newest first.
const key = (task: Task): number => {
	if (task.state === TaskState.Claimed && task.workDeadline !== null) {
		return toMs(task.workDeadline);
	}
	if (rank(task) === 3 && task.transfer?.confirmedAt != null) {
		return -toMs(task.transfer.confirmedAt);
	}

	return toMs(task.claimDeadline);
};

export const sortTasks = (orders: Order[]): Task[] =>
	orders
		.flatMap((order) => order.tasks)
		.sort((left, right) => rank(left) - rank(right) || key(left) - key(right));
