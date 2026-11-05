// Linguist board and claim, and GET /api/tasks/:id (api.md, ADR 0023). No route moves money.
import { type Context, Hono } from "hono";
import { canView, currentLinguist, denied, isOwnerFirm } from "./access.js";
import type { TasksDeps } from "./deps.js";
import { firmRoutes } from "./firmRoutes.js";
import { ClaimOutcome, claimTask } from "./lifecycle.js";
import { linguistRoutes } from "./linguistRoutes.js";
import { boardTasks, taskById } from "./repo.js";
import type { LangPair, Task } from "./types.js";
import { boardItem, viewOf } from "./view.js";
import { workRoutes } from "./workRoutes.js";

export const inPairs = (pairs: LangPair[], task: Task): boolean =>
	pairs.some(
		(pair) =>
			pair.source === task.sourceLang && pair.target === task.targetLang,
	);

export const tasksRoutes = (deps: TasksDeps): Hono => {
	const app = new Hono();
	// The claimer's pairs for the owner firm; null while open and for other callers (ADR 0033).
	const executorPairs = (ctx: Context, task: Task): LangPair[] | null =>
		task.linguistId !== null && isOwnerFirm(deps, ctx, task)
			? deps.linguistPairs(task.linguistId)
			: null;

	app.get("/api/board", (ctx) => {
		const linguist = currentLinguist(deps, ctx);
		if (linguist instanceof Response) {
			return linguist;
		}
		const pairs = deps.linguistPairs(linguist.linguistId);
		const now = deps.now();
		const tasks = boardTasks(deps.database, now).filter((task) =>
			inPairs(pairs, task),
		);
		const serverTime = new Date(now).toISOString();
		return ctx.json({
			serverTime,
			tasks: tasks.map((task) => boardItem(deps, task)),
		});
	});

	app.post("/api/tasks/:id/claim", (ctx) => {
		const linguist = currentLinguist(deps, ctx);
		if (linguist instanceof Response) {
			return linguist;
		}
		const taskId = ctx.req.param("id");
		const found = taskById(deps.database, taskId);
		if (!found || !inPairs(deps.linguistPairs(linguist.linguistId), found)) {
			return ctx.json({ error: "not_found" }, 404);
		}
		const now = deps.now();
		const outcome = claimTask(
			deps.database,
			taskId,
			linguist,
			now,
			deps.workWindowSeconds,
		);
		const claimed = taskById(deps.database, taskId);
		if (outcome === ClaimOutcome.NotFound || !claimed) {
			return ctx.json({ error: "not_found" }, 404);
		}
		if (outcome !== ClaimOutcome.Claimed) {
			return ctx.json({ error: outcome }, 409);
		}
		return ctx.json(viewOf(deps, claimed));
	});

	app.get("/api/tasks/:id", (ctx) => {
		const task = taskById(deps.database, ctx.req.param("id"));
		if (!task) {
			return ctx.json({ error: "not_found" }, 404);
		}
		const allowed = canView(deps, ctx, task);
		if (allowed !== true) {
			return denied(ctx, allowed === false);
		}
		const serverTime = new Date(deps.now()).toISOString();
		return ctx.json({
			serverTime,
			...viewOf(deps, task),
			executorPairs: executorPairs(ctx, task),
		});
	});

	app.route("/", workRoutes(deps));
	app.route("/", firmRoutes(deps));
	app.route("/", linguistRoutes(deps));
	return app;
};
