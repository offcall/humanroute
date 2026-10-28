// Decisions and their pending transfer commit in one SQLite transaction (ADR 0005, ADR 0023).
// approveTask/rejectTask are the tasks Decider; sweepExpired refunds unclaimed and late tasks.
import { withTransaction } from "../store/index.js";
import {
	listExpiredLate,
	listExpiredUnclaimed,
	markApproved,
	markLate,
	markRejected,
	markUnclaimed,
	type Task,
	TaskState,
	taskById,
} from "../tasks/index.js";
import { taskLedger } from "./ledger.js";
import { memoFor, refundLegs, splitLegs } from "./legs.js";
import { PayoutKind, type TaskPayoutDeps } from "./taskTypes.js";

// Runs the guarded task update; on success inserts the transfer for the new state.
const decide = (
	deps: TaskPayoutDeps,
	task: Task,
	state: TaskState,
	mark: (now: number) => boolean,
): boolean =>
	withTransaction(deps.database, () => {
		const now = deps.now();
		if (!mark(now)) {
			return false;
		}
		const payout = state === TaskState.Approved;
		taskLedger(deps.database).insert(
			{
				id: deps.newId(),
				taskId: task.id,
				kind: payout ? PayoutKind.Payout : PayoutKind.Refund,
				legs: payout ? splitLegs(task, deps.shares) : refundLegs(task),
				memo: memoFor(task.id, state),
			},
			now,
		);
		return true;
	});

export const approveTask =
	(deps: TaskPayoutDeps) =>
	(taskId: string): boolean => {
		const task = taskById(deps.database, taskId);
		return task
			? decide(deps, task, TaskState.Approved, (now) =>
					markApproved(deps.database, taskId, now),
				)
			: false;
	};

export const rejectTask =
	(deps: TaskPayoutDeps) =>
	(taskId: string, reason: string): boolean => {
		const task = taskById(deps.database, taskId);
		return task
			? decide(deps, task, TaskState.Rejected, (now) =>
					markRejected(deps.database, taskId, reason, now),
				)
			: false;
	};

// Refund decisions for tasks past their claim or work deadline; returns the decided memos.
export const sweepExpired = (deps: TaskPayoutDeps): string[] => {
	const { database } = deps;
	const now = deps.now();
	const decided: string[] = [];
	for (const task of listExpiredUnclaimed(database, now)) {
		const state = TaskState.ExpiredUnclaimed;
		if (
			decide(deps, task, state, (at) => markUnclaimed(database, task.id, at))
		) {
			decided.push(memoFor(task.id, state));
		}
	}
	for (const task of listExpiredLate(database, now)) {
		const state = TaskState.ExpiredLate;
		if (decide(deps, task, state, (at) => markLate(database, task.id, at))) {
			decided.push(memoFor(task.id, state));
		}
	}
	return decided;
};
