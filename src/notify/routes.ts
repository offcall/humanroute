// Push routes (ADR 0029). The session lookup is passed in by http (ADR 0019).
import { type Context, Hono } from "hono";
import { getCookie } from "hono/cookie";
import { findLinguistByWallet } from "../accounts/index.js";
import { parseEndpoint, parseSubscription, readJson } from "./body.js";
import { removeSubscription, saveSubscription } from "./repo.js";
import type { NotifyDeps } from "./types.js";

const failure = (
	ctx: Context,
	status: 400 | 401 | 403 | 422,
	error: string,
): Response => ctx.json({ error }, status);

export const notifyRoutes = (deps: NotifyDeps): Hono => {
	const app = new Hono();

	app.get("/api/push/key", (ctx) => ctx.json({ publicKey: deps.publicKey }));

	app.post("/api/push/subscribe", async (ctx) => {
		const wallet = deps.lookupSession(getCookie(ctx, deps.sessionCookie));
		if (wallet === null) {
			return failure(ctx, 401, "unauthorized");
		}

		const link = findLinguistByWallet(deps.database, wallet);
		if (link === null) {
			return failure(ctx, 403, "forbidden");
		}

		const raw = await readJson(ctx);
		if (raw === undefined) {
			return failure(ctx, 400, "malformed_body");
		}

		const target = parseSubscription(raw);
		if (target === null) {
			return failure(ctx, 422, "invalid_body");
		}

		saveSubscription(deps.database, link.linguistId, target, deps.now());

		return ctx.body(null, 204);
	});

	// No session needed: the endpoint is the device's secret, and logout may race the session.
	app.post("/api/push/unsubscribe", async (ctx) => {
		const raw = await readJson(ctx);
		if (raw === undefined) {
			return failure(ctx, 400, "malformed_body");
		}

		const endpoint = parseEndpoint(raw);
		if (endpoint === null) {
			return failure(ctx, 422, "invalid_body");
		}

		removeSubscription(deps.database, endpoint);

		return ctx.body(null, 204);
	});

	return app;
};
