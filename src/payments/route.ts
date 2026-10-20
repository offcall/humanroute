// POST /x/translate: readiness -> body validation -> replay check -> x402 verify/handler/settle
// -> job + payment recorded from PAYMENT-RESPONSE. A job exists only once money has moved.
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { Hono } from "hono";
import { capturePayment } from "./capture.js";
import { readinessGate, validateBody } from "./guards.js";
import type { PaymentsDeps, PaymentsEnv } from "./types.js";

export const paymentsRoutes = (deps: PaymentsDeps): Hono<PaymentsEnv> => {
	const { config } = deps;
	const server = new x402ResourceServer(deps.facilitator).register(
		config.network,
		new ExactSvmScheme(),
	);
	// Explicit asset + base units, so any 6-decimal mint (devnet USDC or a test mint) works.
	const price = {
		amount: config.priceUnits.toString(),
		asset: config.usdcMint,
	};
	const routes = {
		"POST /x/translate": {
			accepts: [
				{ scheme: "exact", price, network: config.network, payTo: deps.payTo },
			],
			description: "Human translation job",
			mimeType: "application/json",
		},
	};

	const app = new Hono<PaymentsEnv>();
	app.use(
		"/x/translate",
		readinessGate(deps.preflightProblems),
		validateBody,
		capturePayment(deps),
	);
	app.use("/x/translate", paymentMiddleware(routes, server));
	// The x402 middleware settles after this 202; capturePayment then replaces the body with the job id.
	app.post("/x/translate", (ctx) => ctx.json({ pending: true }, 202));
	return app;
};
