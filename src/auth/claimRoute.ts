// POST /api/auth/login-request/:id/claim (ADR 0034).
import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { readJson } from "./body.js";
import { clearLoginCookie, setSessionCookie } from "./cookies.js";
import { claimLoginRequest } from "./loginClaim.js";
import { createSession } from "./session.js";
import {
	type AuthDeps,
	type Claim,
	LOGIN_COOKIE,
	LoginOutcome,
} from "./types.js";

export const REQUEST_ID = /^[0-9a-f]{32}$/;

export const claimRoute = (deps: AuthDeps) => async (ctx: Context) => {
	ctx.header("Cache-Control", "no-store");
	if (!(await readJson(ctx)).ok) {
		return ctx.json({ error: "malformed_body" }, 400);
	}

	const requestId = ctx.req.param("id") ?? "";
	const claim: Claim = REQUEST_ID.test(requestId)
		? claimLoginRequest(deps, requestId, getCookie(ctx, LOGIN_COOKIE))
		: { outcome: LoginOutcome.Gone };

	if (claim.outcome === LoginOutcome.Pending) {
		return ctx.json({ status: "pending" }, 202);
	}

	clearLoginCookie(ctx, deps);
	if (claim.outcome !== LoginOutcome.Done) {
		return ctx.json({ status: "gone" }, 410);
	}

	setSessionCookie(ctx, deps, createSession(deps, claim.wallet));

	return ctx.json({ wallet: claim.wallet });
};
