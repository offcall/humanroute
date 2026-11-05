// Sign-in via approve in Phantom (ADR 0034): create, approve, reject, claim.
import { type Context, Hono } from "hono";
import { parseVerifyBody, readJson } from "./body.js";
import { claimRoute, REQUEST_ID } from "./claimRoute.js";
import { setLoginCookie } from "./cookies.js";
import {
	approveLoginRequest,
	createLoginRequest,
	rejectLoginRequest,
} from "./loginStore.js";
import { consumeNonce } from "./nonce.js";
import { type AuthDeps, LOGIN_PATH, LoginOutcome } from "./types.js";
import { verifyEd25519 } from "./verify.js";

const settled = (
	ctx: Context,
	outcome: LoginOutcome,
	done: () => Response,
): Response => {
	if (outcome === LoginOutcome.Done) {
		return done();
	}

	return outcome === LoginOutcome.Conflict
		? ctx.json({ error: "already_settled" }, 409)
		: ctx.json({ error: "gone" }, 410);
};

export const loginRoutes = (deps: AuthDeps): Hono => {
	const app = new Hono();

	app.post(LOGIN_PATH, async (ctx) => {
		if (!(await readJson(ctx)).ok) {
			return ctx.json({ error: "malformed_body" }, 400);
		}

		const { requestId, secret, expiresAt } = createLoginRequest(deps);
		setLoginCookie(ctx, deps, secret);

		return ctx.json({ id: requestId, expiresAt }, 201);
	});

	// No session is set here: this runs in Phantom's browser, the waiting tab claims it.
	app.post(`${LOGIN_PATH}/:id/approve`, async (ctx) => {
		const body = await readJson(ctx);
		const input = body.ok ? parseVerifyBody(body.value) : null;
		if (input === null) {
			return ctx.json({ error: "unauthorized" }, 401);
		}

		const message = consumeNonce(deps, input.wallet, input.nonce);
		if (
			message === null ||
			!verifyEd25519(input.publicKey, message, input.signature)
		) {
			return ctx.json({ error: "unauthorized" }, 401);
		}

		const requestId = ctx.req.param("id");
		const outcome = REQUEST_ID.test(requestId)
			? approveLoginRequest(deps, requestId, input.wallet)
			: LoginOutcome.Gone;

		return settled(ctx, outcome, () => ctx.json({}));
	});

	app.post(`${LOGIN_PATH}/:id/reject`, async (ctx) => {
		if (!(await readJson(ctx)).ok) {
			return ctx.json({ error: "malformed_body" }, 400);
		}

		const requestId = ctx.req.param("id");
		const outcome = REQUEST_ID.test(requestId)
			? rejectLoginRequest(deps, requestId)
			: LoginOutcome.Gone;

		return settled(ctx, outcome, () => ctx.body(null, 204));
	});

	app.post(`${LOGIN_PATH}/:id/claim`, claimRoute(deps));

	return app;
};
