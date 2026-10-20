// Hono app: health, paid x402 route, expert inbox, job status.
import { Hono } from "hono";
import { paymentsRoutes } from "../payments/index.js";
import { inboxRoutes } from "./inbox.js";
import { statusRoutes } from "./status.js";
import type { AppDeps } from "./types.js";

export const createApp = (deps: AppDeps): Hono => {
	const app = new Hono();
	const { store, now } = deps;
	app.get("/health", (ctx) =>
		ctx.json({ ok: true, ready: deps.preflightProblems().length === 0 }),
	);
	app.route("/", paymentsRoutes(deps));
	app.route(
		"/",
		statusRoutes({ store, now, statusSecret: deps.config.statusSecret }),
	);
	app.route(
		"/",
		inboxRoutes({ store, now, inboxToken: deps.config.inboxToken }),
	);
	return app;
};
