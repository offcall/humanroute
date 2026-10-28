// Order draft over the firm's MCP token, then the x402 exact payment with the agent signer.
import type { KeyPairSigner } from "@solana/kit";
import { type PaymentPolicy, x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { call, readBody, stringField } from "./http.js";

const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const LEAFLET =
	"Take one tablet twice a day with food. Do not exceed four tablets in 24 hours. Keep out of reach of children.";
const DRAFTS: Record<string, string> = {
	es: "Tome un comprimido dos veces al día con comida. No supere cuatro comprimidos en 24 horas. Mantener fuera del alcance de los niños.",
	fr: "Prendre un comprimé deux fois par jour avec de la nourriture. Ne pas dépasser quatre comprimés en 24 heures. Tenir hors de portée des enfants.",
	de: "Zweimal täglich eine Tablette mit einer Mahlzeit einnehmen. Nicht mehr als vier Tabletten in 24 Stunden. Für Kinder unzugänglich aufbewahren.",
};

export type Receipt = { orderId: string; payTx: string };

// Exact-amount policy: pay only the total the draft quoted (like the pay page).
// The default $1 USD cap is off: the exact policy already bounds the amount,
// and a multi-task order total is above $1.
const payingFetch = (
	signer: KeyPairSigner,
	totalUnits: string,
): typeof fetch => {
	const exact: PaymentPolicy = (_version, requirements) =>
		requirements.filter((requirement) => requirement.amount === totalUnits);
	const client = x402Client.fromConfig({
		schemes: [{ network: SOLANA_DEVNET, client: new ExactSvmScheme(signer) }],
		policies: [exact],
		spendControls: { maxAmountPerPayment: false },
	});
	return wrapFetchWithPayment(fetch, client);
};

export const createAndPay = async (
	gateway: string,
	mcpToken: string,
	signer: KeyPairSigner,
): Promise<Receipt> => {
	const targets = Object.entries(DRAFTS).map(([targetLang, draft]) => ({
		targetLang,
		draft,
	}));
	const draft = await call(gateway, "POST", "/api/orders/draft", "draft", {
		bearer: mcpToken,
		body: {
			text: LEAFLET,
			sourceLang: "en",
			targets,
			meta: { product: "e2e leaflet" },
		},
	});
	const draftId = stringField(draft, "draftId");
	const totalUnits = stringField(draft, "totalUnits");
	console.log(`draft ${draftId} total ${totalUnits} units`);

	const payRes = await payingFetch(signer, totalUnits)(
		`${gateway}/x/orders/${draftId}`,
		{ method: "POST" },
	);
	const order = await readBody(payRes, "pay");
	const receipt = {
		orderId: stringField(order, "orderId"),
		payTx: stringField(order, "payTx"),
	};
	console.log(`order ${receipt.orderId} payTx ${receipt.payTx}`);
	return receipt;
};
