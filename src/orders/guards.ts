// Runs before x402: refuse when preflight fails (503) and answer unknown or paid drafts (404, 409,
// replay 201) so they are never charged.
import type { MiddlewareHandler } from "hono";
import { draftById } from "./drafts.js";
import { paymentById, receiptOf } from "./orderRepo.js";
import { paymentHeader, paymentId } from "./paymentId.js";
import type { OrdersDeps, OrdersEnv } from "./types.js";

export const readinessGate =
	(preflightProblems: () => string[]): MiddlewareHandler<OrdersEnv> =>
	async (ctx, next) => {
		const reasons = preflightProblems();
		if (reasons.length > 0) {
			const error = "not_ready";
			return ctx.json({ error, reasons }, 503, { "Retry-After": "30" });
		}
		await next();
	};

export const draftGate =
	(deps: OrdersDeps): MiddlewareHandler<OrdersEnv> =>
	async (ctx, next) => {
		const draft = draftById(deps, ctx.req.param("draftId") ?? "");
		if (!draft) {
			return ctx.json({ error: "not_found" }, 404);
		}
		if (draft.orderId !== null) {
			const payId = paymentId(paymentHeader((name) => ctx.req.header(name)));
			const known = payId ? paymentById(deps.database, payId) : null;
			const receipt =
				known?.draftId === draft.id
					? receiptOf(deps.database, known.orderId)
					: null;
			return receipt
				? ctx.json(receipt, 201)
				: ctx.json({ error: "draft_paid" }, 409);
		}
		ctx.set("draft", draft);
		await next();
	};
