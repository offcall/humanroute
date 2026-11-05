// POST /api/tasks/:id/submit: the claimer submits before the work deadline (ADR 0023).
import { Hono } from "hono";
import { currentLinguist } from "./access.js";
import { parseResult, readJson } from "./body.js";
import type { TasksDeps } from "./deps.js";
import { SubmitOutcome, submitTask } from "./lifecycle.js";
import { taskById } from "./repo.js";
import { viewOf } from "./view.js";

export const workRoutes = (deps: TasksDeps): Hono => {
	const app = new Hono();

	app.post("/api/tasks/:id/submit", async (ctx) => {
		const linguist = currentLinguist(deps, ctx);
		if (linguist instanceof Response) {
			return linguist;
		}
		const body = await readJson(ctx);
		if (!body.ok) {
			return ctx.json({ error: "invalid_json" }, 400);
		}
		const result = parseResult(body.value);
		if (result === null) {
			return ctx.json({ error: "invalid_body" }, 422);
		}
		const taskId = ctx.req.param("id");
		const outcome = submitTask(
			deps.database,
			taskId,
			linguist.linguistId,
			result,
			deps.now(),
		);
		const task = taskById(deps.database, taskId);
		if (outcome === SubmitOutcome.NotFound || !task) {
			return ctx.json({ error: "not_found" }, 404);
		}
		if (outcome === SubmitOutcome.Forbidden) {
			return ctx.json({ error: "forbidden" }, 403);
		}
		if (outcome !== SubmitOutcome.Submitted) {
			return ctx.json({ error: outcome }, 409);
		}
		return ctx.json(viewOf(deps, task));
	});

	return app;
};
