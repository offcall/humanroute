// POST /x/orders/:draftId: readiness -> draft gate -> replay check -> x402 verify/handler/settle
// -> order + tasks recorded from PAYMENT-RESPONSE. The price is the draft's totalUnits.
import type { DynamicPrice } from "@x402/core/http";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { Hono } from "hono";
import { capturePayment } from "./capture.js";
import { draftById } from "./drafts.js";
import { draftGate, readinessGate } from "./guards.js";
import type { OrdersDeps, OrdersEnv } from "./types.js";

const PAY_PATH = "/x/orders/:draftId";

export const payRoute = (deps: OrdersDeps): Hono<OrdersEnv> => {
	const server = new x402ResourceServer(deps.facilitator).register(
		deps.network,
		new ExactSvmScheme(),
	);
	// Explicit asset + base units, so any 6-decimal mint (devnet USDC or a test mint) works.
	const price: DynamicPrice = (context) => {
		const draftId = context.path.split("/").pop() ?? "";
		const draft = draftById(deps, draftId);
		if (!draft) {
			throw new Error(`draft ${draftId} not found`);
		}
		return { amount: draft.totalUnits.toString(), asset: deps.usdcMint };
	};
	const routes = {
		[`POST ${PAY_PATH}`]: {
			accepts: [
				{ scheme: "exact", price, network: deps.network, payTo: deps.payTo },
			],
			description: "Human translation order",
			mimeType: "application/json",
		},
	};

	const app = new Hono<OrdersEnv>();
	app.use(
		PAY_PATH,
		readinessGate(deps.preflightProblems),
		draftGate(deps),
		capturePayment(deps),
	);
	app.use(PAY_PATH, paymentMiddleware(routes, server));
	// The x402 middleware settles after this response; capturePayment then replaces it with the order.
	app.post(PAY_PATH, (ctx) => ctx.json({ pending: true }, 200));
	return app;
};
