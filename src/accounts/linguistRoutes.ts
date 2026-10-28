import { Hono } from "hono";
import { hasJsonType, parsePairs, readJson } from "./body.js";
import { joinAgency, replacePairs } from "./linguists.js";
import { findLinguistByWallet } from "./lookups.js";
import {
	failure,
	invalid,
	malformed,
	sessionWallet,
	unauthorized,
} from "./session.js";
import type { AccountsDeps } from "./types.js";

// GET /api/linguist (cabinet) is served by the tasks slice.
export const linguistRoutes = (deps: AccountsDeps): Hono => {
	const app = new Hono();

	app.post("/api/linguist/join/:inviteCode", (ctx) => {
		const wallet = sessionWallet(deps, ctx);
		if (wallet === null) {
			return unauthorized(ctx);
		}

		if (!hasJsonType(ctx)) {
			return malformed(ctx);
		}

		const inviteCode = ctx.req.param("inviteCode");
		if (inviteCode === undefined) {
			return failure(ctx, 404, "not_found");
		}

		const result = joinAgency(deps, wallet, inviteCode);
		if (result.kind === "not_found") {
			return failure(ctx, 404, "not_found");
		}
		if (result.kind === "other_agency") {
			return failure(ctx, 409, "already_in_agency");
		}

		return ctx.json({
			linguist: {
				id: result.link.linguistId,
				wallet: result.link.linguistWallet,
				agencyId: result.link.agencyId,
			},
			agency: { id: result.agency.id, name: result.agency.name },
		});
	});

	app.put("/api/linguist/languages", async (ctx) => {
		const wallet = sessionWallet(deps, ctx);
		if (wallet === null) {
			return unauthorized(ctx);
		}

		const link = findLinguistByWallet(deps.database, wallet);
		if (link === null) {
			return failure(ctx, 403, "forbidden");
		}

		const body = await readJson(ctx);
		if (!body.ok) {
			return malformed(ctx);
		}

		const pairs = parsePairs(body.value);
		if (pairs === null) {
			return invalid(ctx);
		}

		return ctx.json({ pairs: replacePairs(deps, link.linguistId, pairs) });
	});

	return app;
};
