// Auto-pay routes (ADR 0036, 0045): the firm's allowance for the cabinet, the wait for its
// approve or revoke, and the unsigned delegate payment for MCP prepare_payment. Nothing is signed
// or sent here.
import { Hono } from "hono";
import { CHAIN_DOWN } from "./autopay.js";
import {
	ConfirmOutcome,
	isTxSignature,
	waitConfirmed,
} from "./autopayConfirm.js";
import { autopayView } from "./autopayView.js";
import { isRecord } from "./body.js";
import { cookieFirm, denied } from "./caller.js";
import type { OrdersDeps } from "./types.js";
import { unsignedRoute } from "./unsignedRoute.js";

const readSignature = async (req: Request): Promise<string | null> => {
	const raw: unknown = await req.json().catch(() => undefined);
	const signature = isRecord(raw) ? raw.signature : undefined;
	return typeof signature === "string" && isTxSignature(signature)
		? signature
		: null;
};

export const autopayRoutes = (deps: OrdersDeps): Hono => {
	const app = new Hono();

	app.get("/api/firm/autopay", async (ctx) => {
		const caller = cookieFirm(deps, ctx);
		const wallet =
			caller.kind === "firm" ? deps.firmWallet(caller.firmId) : null;
		if (wallet === null) {
			return denied(ctx, caller);
		}
		const view = await autopayView(deps, wallet);
		return view === null ? ctx.json(CHAIN_DOWN, 502) : ctx.json(view);
	});

	app.post("/api/firm/autopay/confirm", async (ctx) => {
		const caller = cookieFirm(deps, ctx);
		const wallet =
			caller.kind === "firm" ? deps.firmWallet(caller.firmId) : null;
		if (wallet === null) {
			return denied(ctx, caller);
		}
		const signature = await readSignature(ctx.req.raw);
		if (signature === null) {
			return ctx.json({ error: "invalid_signature" }, 422);
		}
		const waited = await waitConfirmed(deps, signature, ctx.req.raw.signal);
		if (waited.outcome === ConfirmOutcome.Failed) {
			return ctx.json({ error: "tx_failed", message: waited.error }, 409);
		}
		if (waited.outcome === ConfirmOutcome.NotConfirmed) {
			return ctx.json({ error: "not_confirmed" }, 504);
		}
		const view = await autopayView(deps, wallet);
		return view === null ? ctx.json(CHAIN_DOWN, 502) : ctx.json(view);
	});

	app.route("/", unsignedRoute(deps));
	return app;
};
