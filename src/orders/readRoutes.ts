// Order reads: public draft status for the pay page and MCP get_task, the firm's orders.
import { type Context, Hono } from "hono";
import { publicState, tasksByOrder, viewOf } from "../tasks/index.js";
import { bearerFirm, cookieFirm, denied } from "./caller.js";
import { readState } from "./draftState.js";
import { storedDraft } from "./drafts.js";
import { orderById, ordersByFirm } from "./orderRepo.js";
import type { Order, OrdersDeps } from "./types.js";

export const readRoutes = (deps: OrdersDeps, inflight: Set<string>): Hono => {
	const app = new Hono();
	const taskViews = (order: Order) =>
		tasksByOrder(deps.database, order.id).map((task) => viewOf(deps, task));
	const serverTime = () => new Date(deps.now()).toISOString();

	app.get("/api/orders/draft/:draftId", (ctx) => {
		const draft = storedDraft(deps, ctx.req.param("draftId"));
		const read = draft === null ? null : readState(deps, inflight, draft);
		if (draft === null || read === null) {
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
			payUrl: `${deps.publicBaseUrl.replace(/\/$/, "")}/pay/${draft.id}`,
			...read,
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
		return ctx.json({ serverTime: serverTime(), orders });
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
			serverTime: serverTime(),
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
