// Order draft over the firm's MCP token and the x402 exact payment signed by a Node key, as
// scripts/e2e/pay.ts does, with the environment's RPC (localnet or devnet).
import { createKeyPairSignerFromBytes } from "@solana/kit";
import type { Keypair } from "@solana/web3.js";
import { x402Client } from "@x402/core/client";
import {
	decodePaymentRequiredHeader,
	encodePaymentSignatureHeader,
} from "@x402/core/http";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { e2eEnv, gatewayUrl, pacePayment } from "./env.js";
import { type Body, call, isRecord, text } from "./http.js";

export const LEAFLET =
	"Take one tablet twice a day with food. Do not exceed four tablets in 24 hours.";

export type Draft = { draftId: string; totalUnits: bigint; payUrl: string };

export const createDraft = async (
	mcpToken: string,
	langs: string[],
): Promise<Draft> => {
	const targets = langs.map((targetLang) => ({
		targetLang,
		draft: `Machine draft (${targetLang}).`,
	}));
	const body = await call(gatewayUrl(), "POST", "/api/orders/draft", {
		bearer: mcpToken,
		body: { text: LEAFLET, sourceLang: "en", targets, meta: { e2e: "yes" } },
	});
	return {
		draftId: text(body, "draftId"),
		totalUnits: BigInt(text(body, "totalUnits")),
		payUrl: text(body, "payUrl"),
	};
};

const payUrl = (draftId: string): string =>
	`${gatewayUrl()}/x/orders/${draftId}`;

// A fresh PAYMENT-SIGNATURE for the draft's 402 offer, exact amount only (as the pay page;
// spend controls off so the local mint is accepted).
export const signedHeader = async (
	key: Keypair,
	draft: Draft,
): Promise<string> => {
	const env = e2eEnv();
	const offer = await fetch(payUrl(draft.draftId), { method: "POST" });
	const header = offer.headers.get("PAYMENT-REQUIRED");
	if (offer.status !== 402 || header === null) {
		throw new Error(`no 402 offer for ${draft.draftId}: ${offer.status}`);
	}
	const signer = await createKeyPairSignerFromBytes(key.secretKey);
	const client = new x402Client()
		.register(env.network, new ExactSvmScheme(signer, { rpcUrl: env.rpcUrl }))
		.setSpendControls(false)
		.registerPolicy((_version, requirements) =>
			requirements.filter((item) => item.amount === String(draft.totalUnits)),
		);
	const payload = await client.createPaymentPayload(
		decodePaymentRequiredHeader(header),
	);
	return encodePaymentSignatureHeader(payload);
};

export const postPayment = async (
	draftId: string,
	header: string,
): Promise<{ status: number; body: Body }> => {
	await pacePayment();
	const res = await fetch(payUrl(draftId), {
		method: "POST",
		headers: { "PAYMENT-SIGNATURE": header },
	});
	const raw: unknown = await res.json().catch(() => ({}));
	return { status: res.status, body: isRecord(raw) ? raw : {} };
};

export type Paid = { orderId: string; payTx: string; body: Body };

export const payDraft = async (key: Keypair, draft: Draft): Promise<Paid> => {
	const { status, body } = await postPayment(
		draft.draftId,
		await signedHeader(key, draft),
	);
	if (status !== 201) {
		throw new Error(
			`pay ${draft.draftId}: HTTP ${status} ${JSON.stringify(body)}`,
		);
	}
	return { orderId: text(body, "orderId"), payTx: text(body, "payTx"), body };
};
