// Review queue: a snapshot on entry; polls only append new submitted tasks. Pure.
import { type Order, type Task, TaskState } from "../shared";
import { sortTasks } from "./sortTasks";

// taskIds: the queue in review order; mine: tasks decided here (they stay for the count and the summary).
export type Queue = { taskIds: string[]; mine: string[] };

export const EMPTY_QUEUE: Queue = { taskIds: [], mine: [] };

// A task decided elsewhere (Claude, a timer) leaves; new submitted tasks join the end.
export const mergeQueue = (queue: Queue, orders: Order[]): Queue => {
	const submitted = new Set(
		sortTasks(orders)
			.filter((task) => task.state === TaskState.Submitted)
			.map((task) => task.taskId),
	);
	const kept = queue.taskIds.filter(
		(taskId) => submitted.has(taskId) || queue.mine.includes(taskId),
	);
	const added = [...submitted].filter((taskId) => !kept.includes(taskId));

	return { taskIds: [...kept, ...added], mine: queue.mine };
};

export const markDecided = (queue: Queue, taskId: string): Queue =>
	queue.mine.includes(taskId)
		? queue
		: { taskIds: queue.taskIds, mine: [...queue.mine, taskId] };

export type QueueView = {
	current: Task | undefined;
	next: Task | undefined;
	position: number;
	total: number;
	waiting: number;
	decided: Task[];
};

export const viewQueue = (queue: Queue, orders: Order[]): QueueView => {
	const byId = new Map(
		orders.flatMap((order) => order.tasks).map((task) => [task.taskId, task]),
	);
	const pick = (taskId: string | undefined) =>
		taskId === undefined ? undefined : byId.get(taskId);
	const left = queue.taskIds.filter((taskId) => !queue.mine.includes(taskId));
	const current = pick(left[0]);

	return {
		current,
		next: pick(left[1]),
		position:
			current === undefined ? 0 : queue.taskIds.indexOf(current.taskId) + 1,
		total: queue.taskIds.length,
		waiting: left.length,
		decided: queue.mine.flatMap((taskId) => byId.get(taskId) ?? []),
	};
};
