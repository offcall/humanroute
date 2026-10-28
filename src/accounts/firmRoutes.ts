import { Hono } from "hono";
import { parseName, readJson } from "./body.js";
import { createFirm } from "./firms.js";
import { findFirmByWallet, findMcpToken } from "./lookups.js";
import {
	failure,
	invalid,
	malformed,
	sessionWallet,
	unauthorized,
} from "./session.js";
import type { AccountsDeps } from "./types.js";

export const firmRoutes = (deps: AccountsDeps): Hono => {
	const app = new Hono();

	app.post("/api/firm", async (ctx) => {
		const wallet = sessionWallet(deps, ctx);
		if (wallet === null) {
			return unauthorized(ctx);
		}

		const body = await readJson(ctx);
		if (!body.ok) {
			return malformed(ctx);
		}

		const name = parseName(body.value);
		if (name === null) {
			return invalid(ctx);
		}

		const created = createFirm(deps, wallet, name);
		if (created === null) {
			return failure(ctx, 409, "firm_exists");
		}

		return ctx.json(
			{
				firm: created.firm,
				mcp: { url: deps.mcpPublicUrl, token: created.token },
			},
			201,
		);
	});

	app.get("/api/firm", (ctx) => {
		const wallet = sessionWallet(deps, ctx);
		if (wallet === null) {
			return unauthorized(ctx);
		}

		const firm = findFirmByWallet(deps.database, wallet);
		const token = firm === null ? null : findMcpToken(deps.database, firm.id);
		if (firm === null || token === null) {
			return failure(ctx, 404, "not_found");
		}

		return ctx.json({ firm, mcp: { url: deps.mcpPublicUrl, token } });
	});

	return app;
};
