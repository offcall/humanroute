// Hono app: health, slice routes (composition only, ADR 0019) and the web app with SPA fallback.
import { Hono } from "hono";
import { accountsRoutes } from "../accounts/index.js";
import { authRoutes } from "../auth/index.js";
import { ordersRoutes } from "../orders/index.js";
import { ratingRoutes } from "../rating/index.js";
import { tasksRoutes } from "../tasks/index.js";
import type { AppDeps } from "./types.js";
import { webRoutes } from "./web.js";

export const createApp = (deps: AppDeps): Hono => {
	const app = new Hono();
	app.get("/health", (ctx) =>
		ctx.json({ ok: true, ready: deps.preflightProblems().length === 0 }),
	);
	app.route("/", authRoutes(deps.auth));
	app.route("/", accountsRoutes(deps.accounts));
	app.route("/", ordersRoutes(deps.orders));
	app.route("/", tasksRoutes(deps.tasks));
	app.route("/", ratingRoutes(deps.rating));
	// Last: every path that no route above answered.
	app.route("/", webRoutes(deps.webDistDir));
	return app;
};
