// POST /api/orders/draft/:draftId/unsigned (MCP Bearer, ADR 0036): checks the firm's allowance and
// builds the unsigned delegate payment. MCP passes the fee payer from the gateway's own 402.
import { Hono } from "hono";
import { CHAIN_DOWN, checkAutopay } from "./autopay.js";
import { isRecord } from "./body.js";
import { bearerFirm, denied } from "./caller.js";
import { draftById } from "./drafts.js";
import { readinessGate } from "./guards.js";
import { isPublicKey } from "./settle.js";
import type { OrdersDeps } from "./types.js";
import { buildUnsignedTx } from "./unsignedTx.js";

const readFeePayer = async (req: Request): Promise<string | null> => {
	const raw: unknown = await req.json().catch(() => undefined);
	const feePayer = isRecord(raw) ? raw.feePayer : undefined;
	return typeof feePayer === "string" && isPublicKey(feePayer)
		? feePayer
		: null;
};

export const unsignedRoute = (deps: OrdersDeps): Hono => {
	const app = new Hono();

	const unsignedPath = "/api/orders/draft/:draftId/unsigned";
	app.use(unsignedPath, readinessGate(deps.preflightProblems));
	app.post(unsignedPath, async (ctx) => {
		const caller = bearerFirm(deps, ctx);
		if (caller.kind !== "firm") {
			return denied(ctx, caller);
		}
		const draft = draftById(deps, ctx.req.param("draftId"));
		if (!draft) {
			return ctx.json({ error: "not_found" }, 404);
		}
		if (draft.firmId !== caller.firmId) {
			return ctx.json({ error: "forbidden" }, 403);
		}
		if (draft.orderId !== null) {
			return ctx.json({ error: "draft_paid", orderId: draft.orderId }, 409);
		}
		const feePayer = await readFeePayer(ctx.req.raw);
		if (feePayer === null) {
			return ctx.json({ error: "invalid_body" }, 422);
		}
		const firmWallet = deps.firmWallet(draft.firmId);
		if (firmWallet === null) {
			throw new Error(`firm ${draft.firmId} of draft ${draft.id} not found`);
		}
		const account = await deps.tokenAccountOf(firmWallet);
		if (!account.ok) {
			return ctx.json(CHAIN_DOWN, 502);
		}
		const ready = checkAutopay(account.value, draft.totalUnits);
		if (!ready.ok) {
			return ctx.json(
				{ error: ready.refusal.error, ...ready.refusal.detail },
				409,
			);
		}
		const blockhash = await deps.latestBlockhash();
		if (!blockhash.ok) {
			return ctx.json(CHAIN_DOWN, 502);
		}
		const unsigned = buildUnsignedTx({
			firmWallet,
			delegate: ready.delegate,
			feePayer,
			mint: deps.usdcMint,
			payTo: deps.payTo,
			amountUnits: draft.totalUnits,
			blockhash: blockhash.value.blockhash,
		});
		const amountUnits = draft.totalUnits.toString();
		return ctx.json({
			...unsigned,
			signer: ready.delegate,
			amountUnits,
			payTo: deps.payTo,
		});
	});

	return app;
};
