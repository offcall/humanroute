import { SESSION_COOKIE } from "../auth/index.js";
import {
	approveTask,
	confirmedUnits,
	LegRole,
	rejectTask,
	type TaskPayoutDeps,
	transferViewOf,
} from "../payouts/index.js";
import type { TasksDeps } from "../tasks/index.js";
import type { peopleDeps } from "./people.js";
import type { WiringInput } from "./types.js";

export const tasksDeps = (
	input: WiringInput,
	payouts: TaskPayoutDeps,
	people: ReturnType<typeof peopleDeps>,
): TasksDeps => ({
	database: input.database,
	now: input.now,
	sessionCookie: SESSION_COOKIE,
	...people,
	workWindowSeconds: input.config.workWindowSeconds,
	transferOf: transferViewOf(input.database),
	earnedUnits: (taskIds) =>
		confirmedUnits(input.database, taskIds, LegRole.Linguist),
	decider: { approve: approveTask(payouts), reject: rejectTask(payouts) },
});
