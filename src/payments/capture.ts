// Wraps the x402 middleware: replay check before it, job creation from PAYMENT-RESPONSE after it.
// Known payment + same fingerprint -> same 202; different fingerprint -> 409 (ADR 0004).
import type { MiddlewareHandler } from "hono";
import { fingerprint } from "./fingerprint.js";
import { paymentHeader, paymentId } from "./paymentId.js";
import { settled } from "./settled.js";
import { accepted } from "./statusToken.js";
import type { PaymentsDeps, PaymentsEnv } from "./types.js";

export const capturePayment = (
	deps: PaymentsDeps,
): MiddlewareHandler<PaymentsEnv> => {
	const inflight = new Set<string>();
	const secret = deps.config.statusSecret;

	return async (ctx, next) => {
		const body = ctx.get("body");
		if (!body) {
			return next();
		}
		const payId = paymentId(paymentHeader((name) => ctx.req.header(name)));
		const print = fingerprint(body);
		const known = payId ? deps.store.payments.get(payId) : undefined;
		if (known) {
			if (known.fingerprint === print) {
				return ctx.json(accepted(secret, known.jobId), 202);
			}
			return ctx.json(
				{ error: "payment already used for a different request" },
				409,
			);
		}
		if (payId && inflight.has(payId)) {
			return ctx.json({ error: "payment already in progress" }, 409);
		}
		if (payId) {
			inflight.add(payId);
		}
		try {
			await next();
			const header = ctx.res.headers.get("PAYMENT-RESPONSE");
			// 402 / 4xx / 5xx pass through untouched
			if (ctx.res.status >= 300 || !header) {
				return;
			}
			ctx.res = settled(deps, ctx, header, {
				body,
				paymentId: payId,
				fingerprint: print,
			});
		} finally {
			if (payId) {
				inflight.delete(payId);
			}
		}
	};
};
