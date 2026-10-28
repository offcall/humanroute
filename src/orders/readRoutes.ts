// Order reads: public draft status for the pay page and MCP get_task, the firm's orders.
import { type Context, Hono } from "hono";
import { publicState, tasksByOrder, toView } from "../tasks/index.js";
import { bearerFirm, cookieFirm, denied } from "./caller.js";
import { draftById } from "./drafts.js";
import { orderById, ordersByFirm } from "./orderRepo.js";
import { DraftState, type Order, type OrdersDeps } from "./types.js";

export const readRoutes = (deps: OrdersDeps): Hono => {
	const app = new Hono();
	const taskViews = (order: Order) =>
		tasksByOrder(deps.database, order.id).map((task) =>
			toView(task, deps.transferOf(task.id)),
		);

	app.get("/api/orders/draft/:draftId", (ctx) => {
		const draft = draftById(deps, ctx.req.param("draftId"));
		if (!draft) {
			return ctx.json({ error: "not_found" }, 404);
		}
		const paid =
			draft.orderId === null
				? {}
				: {
						orderId: draft.orderId,
						tasks: tasksByOrder(deps.database, draft.orderId).map((task) => ({
							taskId: task.id,
							targetLang: task.targetLang,
							publicState: publicState(task, deps.transferOf(task.id)),
						})),
					};
		return ctx.json({
			draftId: draft.id,
			state: draft.orderId === null ? DraftState.Draft : DraftState.Paid,
			sourceLang: draft.sourceLang,
			targetLangs: draft.targets.map((target) => target.targetLang),
			taskCount: draft.taskCount,
			priceUnits: draft.priceUnits.toString(),
			totalUnits: draft.totalUnits.toString(),
			payTo: deps.payTo,
			mint: deps.usdcMint,
			network: deps.network,
			...paid,
		});
	});

	app.get("/api/orders", (ctx) => {
		const caller = cookieFirm(deps, ctx);
		if (caller.kind !== "firm") {
			return denied(ctx, caller);
		}
		const orders = ordersByFirm(deps.database, caller.firmId).map((order) => ({
			orderId: order.id,
			payTx: order.payTx,
			totalUnits: order.totalUnits.toString(),
			createdAt: new Date(order.createdAt).toISOString(),
			tasks: taskViews(order),
		}));
		return ctx.json({ orders });
	});

	app.get("/api/orders/:id", (ctx: Context) => {
		const order = orderById(deps.database, ctx.req.param("id") ?? "");
		if (!order) {
			return ctx.json({ error: "not_found" }, 404);
		}
		const bearer = bearerFirm(deps, ctx);
		const caller = bearer.kind === "firm" ? bearer : cookieFirm(deps, ctx);
		if (caller.kind !== "firm" || caller.firmId !== order.firmId) {
			return denied(ctx, caller);
		}
		return ctx.json({
			orderId: order.id,
			firmId: order.firmId,
			payTx: order.payTx,
			payer: order.payer,
			totalUnits: order.totalUnits.toString(),
			createdAt: new Date(order.createdAt).toISOString(),
			tasks: taskViews(order),
		});
	});

	return app;
};
