// Approve and reject by the owner firm (cookie or MCP Bearer, ADR 0030). The decision and its pending transfer
// are written by payouts through deps.decider (ADR 0023); false means not submitted any more.
import { type Context, Hono } from "hono";
import { bearerToken, denied, sessionWallet } from "./access.js";
import { parseReason, readJson } from "./body.js";
import type { TasksDeps } from "./deps.js";
import { taskById } from "./repo.js";
import type { Task } from "./types.js";
import { viewOf } from "./view.js";

export const firmRoutes = (deps: TasksDeps): Hono => {
	const app = new Hono();

	// The caller's firm by MCP Bearer token (ADR 0030) or session cookie.
	// undefined: no valid credentials (401); null: signed in, but not a firm (403).
	const callerFirm = (ctx: Context): { id: string } | null | undefined => {
		const token = bearerToken(ctx);
		if (token !== null) {
			return deps.firmByMcpToken(token) ?? undefined;
		}
		const wallet = sessionWallet(deps, ctx);
		return wallet === null ? undefined : deps.firmByWallet(wallet);
	};

	// The task when the caller is its owner firm, else the 401/403/404 response.
	const ownTask = (ctx: Context): Task | Response => {
		const firm = callerFirm(ctx);
		if (firm === undefined) {
			return denied(ctx, false);
		}
		const task = taskById(deps.database, ctx.req.param("id") ?? "");
		if (!task) {
			return ctx.json({ error: "not_found" }, 404);
		}
		return firm?.id === task.firmId ? task : denied(ctx, true);
	};

	const decided = (ctx: Context, taskId: string, done: boolean): Response => {
		const task = taskById(deps.database, taskId);
		if (!done || !task) {
			return ctx.json({ error: "bad_state" }, 409);
		}
		return ctx.json(viewOf(deps, task));
	};

	app.post("/api/tasks/:id/approve", (ctx) => {
		const task = ownTask(ctx);
		if (task instanceof Response) {
			return task;
		}
		return decided(ctx, task.id, deps.decider.approve(task.id));
	});

	app.post("/api/tasks/:id/reject", async (ctx) => {
		const task = ownTask(ctx);
		if (task instanceof Response) {
			return task;
		}
		const body = await readJson(ctx);
		if (!body.ok) {
			return ctx.json({ error: "invalid_json" }, 400);
		}
		const reason = parseReason(body.value);
		if (reason === null) {
			return ctx.json({ error: "reason_required" }, 422);
		}
		return decided(ctx, task.id, deps.decider.reject(task.id, reason));
	});

	return app;
};
