import { type Context, Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import { parseNonceBody, parseVerifyBody, readJson } from "./body.js";
import { setSessionCookie } from "./cookies.js";
import { loginRoutes } from "./loginRoutes.js";
import { consumeNonce, createNonce } from "./nonce.js";
import { createSession, endSession } from "./session.js";
import { type AuthDeps, SESSION_COOKIE } from "./types.js";
import { verifyEd25519 } from "./verify.js";

const unauthorized = (ctx: Context) => ctx.json({ error: "unauthorized" }, 401);

export const authRoutes = (deps: AuthDeps): Hono => {
	const app = new Hono();

	app.post("/api/auth/nonce", async (ctx) => {
		const body = await readJson(ctx);
		if (!body.ok) {
			return ctx.json({ error: "malformed_body" }, 400);
		}

		const wallet = parseNonceBody(body.value);
		if (wallet === null) {
			return ctx.json({ error: "invalid_body" }, 422);
		}

		return ctx.json(createNonce(deps, wallet));
	});

	// ADR 0020: every verify failure returns one generic error.
	app.post("/api/auth/verify", async (ctx) => {
		const body = await readJson(ctx);
		if (!body.ok) {
			return unauthorized(ctx);
		}

		const input = parseVerifyBody(body.value);
		if (input === null) {
			return unauthorized(ctx);
		}

		const message = consumeNonce(deps, input.wallet, input.nonce);
		if (
			message === null ||
			!verifyEd25519(input.publicKey, message, input.signature)
		) {
			return unauthorized(ctx);
		}

		const token = createSession(deps, input.wallet);
		setSessionCookie(ctx, deps, token);

		return ctx.json({ wallet: input.wallet });
	});

	// Idempotent: a missing or unknown session still clears the cookie and returns 204.
	app.post("/api/auth/logout", async (ctx) => {
		const body = await readJson(ctx);
		if (!body.ok) {
			return ctx.json({ error: "malformed_body" }, 400);
		}

		endSession(deps.database, getCookie(ctx, SESSION_COOKIE));
		deleteCookie(ctx, SESSION_COOKIE, { path: "/" });

		return ctx.body(null, 204);
	});

	app.route("/", loginRoutes(deps));

	return app;
};
