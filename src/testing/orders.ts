// A draft over the firm's MCP token and its x402 payment, as Claude and the pay page send them.
import type { Hono } from "hono";
import { expectJson, type Json, send } from "./http.js";
import { paymentHeader, readOffer } from "./payment.js";
import type { TestWallet } from "./wallets.js";

// Two languages: total 2 x TASK_PRICE_USDC (0.50) = 1000000 units.
export const LEAFLET = {
	text: "Take one tablet twice a day with food.",
	sourceLang: "en",
	targets: [
		{
			targetLang: "es",
			draft: "Tome un comprimido dos veces al día con comida.",
		},
		{ targetLang: "fr", draft: "Prendre un comprimé deux fois par jour." },
	],
};

// The 201 body of POST /api/orders/draft.
export const createDraft = async (
	app: Hono,
	mcpToken: string,
	body: unknown = LEAFLET,
): Promise<Json> =>
	expectJson(
		await send(app, "POST", "/api/orders/draft", { bearer: mcpToken, body }),
		201,
	);

// PAYMENT-SIGNATURE for the draft's own 402 offer; a different memo is a different payment.
export const paymentFor = async (
	app: Hono,
	draftId: string,
	payer: TestWallet,
	memo: string,
): Promise<string> => {
	const offer = readOffer(await send(app, "POST", `/x/orders/${draftId}`));

	return paymentHeader(offer, payer.keypair.publicKey, memo);
};

export const payDraft = (
	app: Hono,
	draftId: string,
	header: string,
): Promise<Response> =>
	send(app, "POST", `/x/orders/${draftId}`, {
		headers: { "PAYMENT-SIGNATURE": header },
	});
