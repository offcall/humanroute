// escalateToHuman(): pay POST /x/translate with @x402/fetch and return the parsed 202 response.
import { decodePaymentResponseHeader } from "@x402/fetch";
import { loadSigner } from "./keypair.js";
import { parseAccepted } from "./parse.js";
import { payingFetch } from "./payer.js";
import type { EscalateInput, Escalation, Settlement } from "./types.js";

const readSettlement = (header: string | null): Settlement => {
	if (!header) {
		return { payTx: null, payer: null };
	}
	try {
		const settle = decodePaymentResponseHeader(header);
		return {
			payTx:
				typeof settle.transaction === "string" && settle.transaction
					? settle.transaction
					: null,
			payer:
				typeof settle.payer === "string" && settle.payer ? settle.payer : null,
		};
	} catch {
		return { payTx: null, payer: null };
	}
};

const statusUrlWithToken = (
	gatewayUrl: string,
	statusUrl: string,
	token: string,
): string => {
	const url = new URL(statusUrl, `${gatewayUrl}/`);
	url.searchParams.set("token", token);
	return url.toString();
};

export const escalateToHuman = async (
	input: EscalateInput,
): Promise<Escalation> => {
	const pay = payingFetch(await loadSigner(input.keypairPath));
	const { gatewayUrl, text, sourceLang, targetLang, draft } = input;

	const res = await pay(`${gatewayUrl}/x/translate`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ text, sourceLang, targetLang, draft }),
	});
	const body: unknown = await res.json().catch(() => null);
	if (res.status !== 202) {
		throw new Error(
			`escalation failed: HTTP ${res.status} ${JSON.stringify(body)}`,
		);
	}
	const accepted = parseAccepted(body);
	if (!accepted.ok) {
		throw new Error(`escalation failed: ${accepted.error}`);
	}

	const { jobId, statusUrl, statusToken } = accepted.value;
	return {
		jobId,
		statusToken,
		statusUrl: statusUrlWithToken(gatewayUrl, statusUrl, statusToken),
		...readSettlement(res.headers.get("PAYMENT-RESPONSE")),
	};
};
