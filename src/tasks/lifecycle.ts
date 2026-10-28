// Guarded state changes (ADR 0023). Zero changed rows means the task was not in the expected
// state or past its deadline. The mark* decisions run inside the payouts transaction.
import type { Database } from "../store/index.js";
import { taskById } from "./repo.js";
import { TASKS_SQL } from "./sql.js";
import { type Claimer, type Task, TaskState } from "./types.js";

export enum ClaimOutcome {
	Claimed = "claimed",
	NotFound = "not_found",
	Taken = "claim_taken",
	Closed = "claim_closed",
}

export enum SubmitOutcome {
	Submitted = "submitted",
	NotFound = "not_found",
	Forbidden = "forbidden",
	Late = "late",
	BadState = "bad_state",
}

const changed = (result: { changes: number }): boolean => result.changes === 1;

const claimFailure = (task: Task | null, now: number): ClaimOutcome => {
	if (!task) {
		return ClaimOutcome.NotFound;
	}
	const windowOver =
		task.state === TaskState.ExpiredUnclaimed ||
		(task.state === TaskState.Open && task.claimDeadline <= now);
	return windowOver ? ClaimOutcome.Closed : ClaimOutcome.Taken;
};

export const claimTask = (
	database: Database,
	taskId: string,
	claimer: Claimer,
	now: number,
	workWindowSeconds: number,
): ClaimOutcome => {
	const done = changed(
		database
			.prepare(TASKS_SQL.claim)
			.run(
				claimer.linguistId,
				claimer.linguistWallet,
				claimer.agencyId,
				claimer.agencyWallet,
				now + workWindowSeconds * 1000,
				now,
				taskId,
				now,
			),
	);
	return done
		? ClaimOutcome.Claimed
		: claimFailure(taskById(database, taskId), now);
};

const submitFailure = (
	task: Task | null,
	linguistId: string,
	now: number,
): SubmitOutcome => {
	if (!task) {
		return SubmitOutcome.NotFound;
	}
	if (task.linguistId !== linguistId) {
		return SubmitOutcome.Forbidden;
	}
	const late =
		task.state === TaskState.ExpiredLate ||
		(task.state === TaskState.Claimed &&
			task.workDeadline !== null &&
			task.workDeadline <= now);
	return late ? SubmitOutcome.Late : SubmitOutcome.BadState;
};

export const submitTask = (
	database: Database,
	taskId: string,
	linguistId: string,
	result: string,
	now: number,
): SubmitOutcome => {
	const done = changed(
		database
			.prepare(TASKS_SQL.submit)
			.run(result, now, taskId, linguistId, now),
	);
	return done
		? SubmitOutcome.Submitted
		: submitFailure(taskById(database, taskId), linguistId, now);
};
