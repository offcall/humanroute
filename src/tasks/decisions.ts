// Guarded decisions that payouts runs in the same transaction as the pending transfer (ADR 0023).
import type { Database } from "../store/index.js";
import { TASKS_SQL } from "./sql.js";

export const markApproved = (
	database: Database,
	taskId: string,
	now: number,
): boolean =>
	database.prepare(TASKS_SQL.approve).run(now, taskId).changes === 1;

export const markRejected = (
	database: Database,
	taskId: string,
	reason: string,
	now: number,
): boolean =>
	database.prepare(TASKS_SQL.reject).run(reason, now, taskId).changes === 1;

export const markUnclaimed = (
	database: Database,
	taskId: string,
	now: number,
): boolean =>
	database.prepare(TASKS_SQL.unclaimed).run(now, taskId, now).changes === 1;

export const markLate = (
	database: Database,
	taskId: string,
	now: number,
): boolean =>
	database.prepare(TASKS_SQL.late).run(now, taskId, now).changes === 1;
