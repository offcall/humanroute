// Wraps the x402 middleware: replay check before it, order creation from PAYMENT-RESPONSE after it.
// Known payment + same draft -> same 201; other draft -> 409 payment_reused (ADR 0022).
import type { MiddlewareHandler } from "hono";
import { paymentById, receiptOf } from "./orderRepo.js";
import { paymentHeader, paymentId } from "./paymentId.js";
import { settled } from "./settled.js";
import type { OrdersDeps, OrdersEnv } from "./types.js";

export const draftKeyOf = (draftId: string): string => `draft:${draftId}`;

// inflight: payment ids and draft keys being settled right now (see draftKeyOf).
export const capturePayment =
	(deps: OrdersDeps, inflight: Set<string>): MiddlewareHandler<OrdersEnv> =>
	async (ctx, next) => {
		const draft = ctx.get("draft");
		const payId = paymentId(paymentHeader((name) => ctx.req.header(name)));
		if (!draft || payId === null) {
			return next();
		}
		const known = paymentById(deps.database, payId);
		if (known) {
			const receipt =
				known.draftId === draft.id
					? receiptOf(deps.database, known.orderId)
					: null;
			return receipt
				? ctx.json(receipt, 201)
				: ctx.json({ error: "payment_reused" }, 409);
		}
		const draftKey = draftKeyOf(draft.id);
		if (inflight.has(payId) || inflight.has(draftKey)) {
			return ctx.json({ error: "payment_in_progress" }, 409);
		}
		inflight.add(payId);
		inflight.add(draftKey);
		try {
			await next();
			const header = ctx.res.headers.get("PAYMENT-RESPONSE");
			// 402 / 4xx / 5xx pass through untouched
			if (ctx.res.status >= 300 || !header) {
				return;
			}
			ctx.res = settled(deps, ctx, header, draft, payId);
		} finally {
			inflight.delete(payId);
			inflight.delete(draftKey);
		}
	};
