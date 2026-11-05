// Auto-pay reads (ADR 0036): the firm's allowance for the cabinet, and the unsigned delegate
// payment for MCP prepare_payment. Nothing is signed or sent here.
import { Hono } from "hono";
import { CHAIN_DOWN } from "./autopay.js";
import { cookieFirm, denied } from "./caller.js";
import type { OrdersDeps } from "./types.js";
import { unsignedRoute } from "./unsignedRoute.js";

export const autopayRoutes = (deps: OrdersDeps): Hono => {
	const app = new Hono();

	app.get("/api/firm/autopay", async (ctx) => {
		const caller = cookieFirm(deps, ctx);
		const wallet =
			caller.kind === "firm" ? deps.firmWallet(caller.firmId) : null;
		if (wallet === null) {
			return denied(ctx, caller);
		}
		const [account, blockhash] = await Promise.all([
			deps.tokenAccountOf(wallet),
			deps.latestBlockhash(),
		]);
		if (!account.ok || !blockhash.ok) {
			return ctx.json(CHAIN_DOWN, 502);
		}
		const usdc = account.value;
		const held = usdc.exists
			? {
					balanceUnits: usdc.amount.toString(),
					delegate: usdc.delegate,
					allowanceUnits: usdc.delegatedAmount.toString(),
				}
			: {};
		const base = { wallet, mint: deps.usdcMint, blockhash: blockhash.value };
		return ctx.json({
			...base,
			account: usdc.address,
			exists: usdc.exists,
			...held,
		});
	});

	app.route("/", unsignedRoute(deps));
	return app;
};
