// GET /api/linguist: the linguist cabinet (pairs, confirmed earnings, own tasks). Served from tasks
// because accounts may not import tasks (ADR 0019); open question for the coordinator.
import { Hono } from "hono";
import { denied, sessionWallet } from "./access.js";
import type { TasksDeps } from "./deps.js";
import { tasksByLinguist } from "./repo.js";
import { viewOf } from "./view.js";

export const linguistRoutes = (deps: TasksDeps): Hono => {
	const app = new Hono();

	app.get("/api/linguist", (ctx) => {
		const wallet = sessionWallet(deps, ctx);
		if (wallet === null) {
			return denied(ctx, false);
		}
		const linguist = deps.linguistByWallet(wallet);
		if (linguist === null) {
			return ctx.json({ error: "not_found" }, 404);
		}
		const tasks = tasksByLinguist(deps.database, linguist.linguistId);
		return ctx.json({
			pairs: deps.linguistPairs(linguist.linguistId),
			earnedUnits: deps.earnedUnits(tasks.map((task) => task.id)).toString(),
			tasks: tasks.map((task) => viewOf(deps, task, true)),
		});
	});

	return app;
};
