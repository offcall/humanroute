// Runs before x402: refuse when preflight failed (503), reject invalid bodies (422) so they are never charged.
import type { MiddlewareHandler } from "hono";
import { parseTranslateBody } from "./body.js";
import { paymentHeader } from "./paymentId.js";
import type { PaymentsEnv } from "./types.js";

export const readinessGate =
	(preflightProblems: () => string[]): MiddlewareHandler<PaymentsEnv> =>
	async (ctx, next) => {
		const reasons = preflightProblems();
		if (reasons.length > 0) {
			const error = "not_ready";
			return ctx.json({ error, reasons }, 503, { "Retry-After": "30" });
		}
		await next();
	};

// An empty unpaid POST is a price probe and falls through to the 402.
export const validateBody: MiddlewareHandler<PaymentsEnv> = async (
	ctx,
	next,
) => {
	const paid = paymentHeader((name) => ctx.req.header(name)) !== undefined;
	if (!paid && (await ctx.req.text()).trim() === "") {
		return next();
	}
	let raw: unknown;
	try {
		raw = await ctx.req.json();
	} catch {
		return ctx.json({ error: "invalid JSON body" }, 422);
	}
	const body = parseTranslateBody(raw);
	if (typeof body === "string") {
		return ctx.json({ error: body }, 422);
	}
	ctx.set("body", body);
	await next();
};
