import { Hono } from "hono";
import { createAgency, ensureInvite, inviteUrl } from "./agencies.js";
import { hasJsonType, parseName, readJson } from "./body.js";
import { findAgencyByWallet, findInviteCode } from "./lookups.js";
import {
	failure,
	invalid,
	malformed,
	sessionWallet,
	unauthorized,
} from "./session.js";
import type { AccountsDeps } from "./types.js";

export const agencyRoutes = (deps: AccountsDeps): Hono => {
	const app = new Hono();

	app.post("/api/agency", async (ctx) => {
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

		const agency = createAgency(deps, wallet, name);
		if (agency === null) {
			return failure(ctx, 409, "agency_exists");
		}

		return ctx.json({ agency }, 201);
	});

	app.get("/api/agency", (ctx) => {
		const wallet = sessionWallet(deps, ctx);
		if (wallet === null) {
			return unauthorized(ctx);
		}

		const agency = findAgencyByWallet(deps.database, wallet);
		if (agency === null) {
			return failure(ctx, 404, "not_found");
		}

		const code = findInviteCode(deps.database, agency.id);

		return ctx.json({
			agency,
			inviteUrl: code === null ? null : inviteUrl(deps.publicBaseUrl, code),
		});
	});

	app.post("/api/agency/invite", (ctx) => {
		const wallet = sessionWallet(deps, ctx);
		if (wallet === null) {
			return unauthorized(ctx);
		}

		if (!hasJsonType(ctx)) {
			return malformed(ctx);
		}

		const agency = findAgencyByWallet(deps.database, wallet);
		if (agency === null) {
			return failure(ctx, 403, "forbidden");
		}

		const code = ensureInvite(deps, agency.id);

		return ctx.json({ code, url: inviteUrl(deps.publicBaseUrl, code) });
	});

	return app;
};
