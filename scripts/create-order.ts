// E2E playground: creates an order draft with the firm's MCP token, then pays it with the test
// agent keypair over x402 (ADR 0022). Devnet only; run by hand, never from `npm run check`.
// Env: GATEWAY_URL, FIRM_MCP_TOKEN, AGENT_KEYPAIR_PATH (the key itself is never printed).
import type { KeyPairSigner } from "@solana/kit";
import { type PaymentPolicy, x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { loadSigner } from "../agent/keypair.js";

const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const LEAFLET =
	"Take one tablet twice a day with food. Do not exceed four tablets in 24 hours. Keep out of reach of children.";
const DRAFTS: Record<string, string> = {
	es: "Tome un comprimido dos veces al día con comida. No supere cuatro comprimidos en 24 horas. Mantener fuera del alcance de los niños.",
	fr: "Prendre un comprimé deux fois par jour avec de la nourriture. Ne pas dépasser quatre comprimés en 24 heures. Tenir hors de portée des enfants.",
	de: "Zweimal täglich eine Tablette mit einer Mahlzeit einnehmen. Nicht mehr als vier Tabletten in 24 Stunden. Für Kinder unzugänglich aufbewahren.",
};

const required = (name: string): string => {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is required`);
	}
	return value;
};

// A non-2xx response throws with its body; a 2xx body must be a JSON object.
const readBody = async (
	res: Response,
	step: string,
): Promise<Record<string, unknown>> => {
	const raw: unknown = await res.json().catch(() => undefined);
	if (!res.ok) {
		throw new Error(`${step} failed: ${res.status} ${JSON.stringify(raw)}`);
	}
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		throw new Error(`${step} returned no JSON object`);
	}
	return Object.fromEntries(Object.entries(raw));
};

const stringField = (body: Record<string, unknown>, key: string): string => {
	const value = body[key];
	if (typeof value !== "string") {
		throw new Error(`response has no string ${key}`);
	}
	return value;
};

// Exact-amount policy: pay only the total the draft quoted (like the pay page).
const payingFetch = (
	signer: KeyPairSigner,
	totalUnits: string,
): typeof fetch => {
	const exact: PaymentPolicy = (_version, requirements) =>
		requirements.filter((requirement) => requirement.amount === totalUnits);
	const client = x402Client.fromConfig({
		schemes: [{ network: SOLANA_DEVNET, client: new ExactSvmScheme(signer) }],
		policies: [exact],
	});
	return wrapFetchWithPayment(fetch, client);
};

const main = async (): Promise<void> => {
	const gateway = required("GATEWAY_URL").replace(/\/$/, "");
	const token = required("FIRM_MCP_TOKEN");
	const signer = await loadSigner(required("AGENT_KEYPAIR_PATH"));
	const targets = Object.entries(DRAFTS).map(([targetLang, draft]) => ({
		targetLang,
		draft,
	}));

	const draftRes = await fetch(`${gateway}/api/orders/draft`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${token}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			text: LEAFLET,
			sourceLang: "en",
			targets,
			meta: { product: "demo leaflet" },
		}),
	});
	const draft = await readBody(draftRes, "draft");
	const draftId = stringField(draft, "draftId");
	const totalUnits = stringField(draft, "totalUnits");
	console.log(`draft ${draftId} total ${totalUnits} units`);

	const payRes = await payingFetch(signer, totalUnits)(
		`${gateway}/x/orders/${draftId}`,
		{ method: "POST" },
	);
	const order = await readBody(payRes, "pay");
	const taskIds = order.taskIds;
	if (
		!Array.isArray(taskIds) ||
		!taskIds.every((id) => typeof id === "string")
	) {
		throw new Error("pay response has no taskIds");
	}
	console.log(
		`order ${stringField(order, "orderId")} payTx ${stringField(order, "payTx")}`,
	);
	console.log(`tasks ${taskIds.join(", ")}`);
};

main().catch((err: unknown) => {
	console.error(
		`create-order: ${err instanceof Error ? err.message : String(err)}`,
	);
	process.exit(1);
});
