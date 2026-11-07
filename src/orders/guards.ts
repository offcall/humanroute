// Runs before x402: refuse when preflight fails (503) and answer unknown, paid or orphaned drafts
// (404, 409, replay 201, 502) so they are never charged.
import type { MiddlewareHandler } from "hono";
import { draftById } from "./drafts.js";
import { paymentById, receiptOf } from "./orderRepo.js";
import { orphanBody, orphanOf } from "./orphan.js";
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
		// Money may already be taken for this draft: never verify or settle again (ADR 0043).
		const orphan = orphanOf(deps, draft.id);
		if (orphan) {
			return ctx.json(orphanBody(orphan.payTx), 502);
		}
		ctx.set("draft", draft);
		await next();
	};
