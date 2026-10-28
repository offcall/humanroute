// Reads and inserts on the tasks table. Callers own the transaction.
import type { Database } from "../store/index.js";
import { asRows, int, text } from "./columns.js";
import type { Outcomes } from "./deps.js";
import { manyTasks, oneTask } from "./row.js";
import { TASKS_SQL } from "./sql.js";
import { type NewTask, type Task, TaskState } from "./types.js";

export const insertTasks = (
	database: Database,
	tasks: NewTask[],
	now: number,
): void => {
	const insert = database.prepare(TASKS_SQL.insert);
	for (const task of tasks) {
		insert.run(
			task.id,
			task.orderId,
			task.firmId,
			task.sourceLang,
			task.targetLang,
			task.text,
			task.draft,
			task.priceUnits.toString(),
			task.refundWallet,
			task.claimDeadline,
			now,
			now,
		);
	}
};

export const taskById = (database: Database, taskId: string): Task | null =>
	oneTask(database.prepare(TASKS_SQL.byId).get(taskId));

export const tasksByOrder = (database: Database, orderId: string): Task[] =>
	manyTasks(database.prepare(TASKS_SQL.byOrder).all(orderId));

// Open tasks still inside their claim window.
export const boardTasks = (database: Database, now: number): Task[] =>
	manyTasks(database.prepare(TASKS_SQL.board).all(now));

export const tasksByLinguist = (
	database: Database,
	linguistId: string,
): Task[] => manyTasks(database.prepare(TASKS_SQL.byLinguist).all(linguistId));

export const listExpiredUnclaimed = (database: Database, now: number): Task[] =>
	manyTasks(database.prepare(TASKS_SQL.expiredUnclaimed).all(now));

export const listExpiredLate = (database: Database, now: number): Task[] =>
	manyTasks(database.prepare(TASKS_SQL.expiredLate).all(now));

const ids = (values: unknown[]): string[] =>
	asRows(values).map((record) => text(record, "id"));

export const taskIdsByAgency = (
	database: Database,
	agencyId: string,
): string[] => ids(database.prepare(TASKS_SQL.idsByAgency).all(agencyId));

export const taskIdsByFirm = (database: Database, firmId: string): string[] =>
	ids(database.prepare(TASKS_SQL.idsByFirm).all(firmId));

const outcomes = (values: unknown[]): Outcomes => {
	const counts: Outcomes = { approved: 0, rejected: 0, late: 0 };
	for (const record of asRows(values)) {
		const state = text(record, "state");
		const total = int(record, "total");
		if (state === TaskState.Approved) {
			counts.approved = total;
		} else if (state === TaskState.Rejected) {
			counts.rejected = total;
		} else if (state === TaskState.ExpiredLate) {
			counts.late = total;
		}
	}
	return counts;
};

export const outcomesByAgency = (
	database: Database,
	agencyId: string,
): Outcomes =>
	outcomes(database.prepare(TASKS_SQL.outcomesByAgency).all(agencyId));

export const outcomesByFirm = (database: Database, firmId: string): Outcomes =>
	outcomes(database.prepare(TASKS_SQL.outcomesByFirm).all(firmId));
