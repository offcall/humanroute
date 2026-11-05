// Orders routes (api.md, ADR 0022): draft by MCP Bearer, x402 payment, order reads.
import { Hono } from "hono";
import { autopayRoutes } from "./autopayRoutes.js";
import { parseDraftBody } from "./body.js";
import { bearerFirm, denied } from "./caller.js";
import { insertDraft } from "./drafts.js";
import { payRoute } from "./payRoute.js";
import { readRoutes } from "./readRoutes.js";
import type { OrdersDeps, OrdersEnv } from "./types.js";

export const ordersRoutes = (deps: OrdersDeps): Hono<OrdersEnv> => {
	const app = new Hono<OrdersEnv>();

	app.post("/api/orders/draft", async (ctx) => {
		const caller = bearerFirm(deps, ctx);
		if (caller.kind !== "firm") {
			return denied(ctx, caller);
		}
		let raw: unknown;
		try {
			raw = await ctx.req.json();
		} catch {
			return ctx.json({ error: "invalid_json" }, 400);
		}
		const body = parseDraftBody(raw);
		if (body === null) {
			return ctx.json({ error: "invalid_body" }, 422);
		}
		const draft = insertDraft(deps, caller.firmId, body);
		const base = deps.publicBaseUrl.replace(/\/$/, "");
		return ctx.json(
			{
				draftId: draft.id,
				payUrl: `${base}/pay/${draft.id}`,
				priceUnits: draft.priceUnits.toString(),
				totalUnits: draft.totalUnits.toString(),
				taskCount: draft.taskCount,
			},
			201,
		);
	});

	app.route("/", autopayRoutes(deps));
	app.route("/", payRoute(deps));
	app.route("/", readRoutes(deps));
	return app;
};
