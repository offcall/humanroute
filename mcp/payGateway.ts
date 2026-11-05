// Gateway calls for agent auto-pay (ADR 0036): the gateway's own 402 offer, the unsigned
// delegate payment, and the x402 payment itself.
import { failureReason, fieldOf, readOffer } from "./payHeaders.js";
import { parsePaid, parseUnsigned } from "./payParse.js";
import { type PayClient, PayOutcome } from "./payTypes.js";
import type { Parsed } from "./types.js";

const TIMEOUT_MS = 15_000;

const send = async (
	url: string,
	init: RequestInit,
): Promise<Parsed<Response>> => {
	try {
		const response = await fetch(url, {
			...init,
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		return { ok: true, value: response };
	} catch {
		return { ok: false, error: "gateway is unreachable or did not answer" };
	}
};

const errorCode = async (response: Response): Promise<string> =>
	fieldOf(await response.json().catch(() => undefined), "error") ??
	`HTTP ${response.status}`;

export const createPayClient = (baseUrl: string): PayClient => {
	const payUrl = (draftId: string) =>
		`${baseUrl}/x/orders/${encodeURIComponent(draftId)}`;

	return {
		offer: async (draftId) => {
			const sent = await send(payUrl(draftId), { method: "POST" });
			if (!sent.ok) {
				return sent;
			}
			if (sent.value.status !== 402) {
				return {
					ok: false,
					error: `gateway refused the payment: ${await errorCode(sent.value)}`,
				};
			}
			return readOffer(sent.value);
		},
		unsigned: async (token, draftId, feePayer) => {
			const sent = await send(
				`${baseUrl}/api/orders/draft/${encodeURIComponent(draftId)}/unsigned`,
				{
					method: "POST",
					headers: {
						"content-type": "application/json",
						authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ feePayer }),
				},
			);
			if (!sent.ok) {
				return sent;
			}
			const body: unknown = await sent.value.json().catch(() => undefined);
			return parseUnsigned(sent.value.status, body);
		},
		pay: async (draftId, paymentHeader) => {
			const sent = await send(payUrl(draftId), {
				method: "POST",
				headers: { "PAYMENT-SIGNATURE": paymentHeader },
			});
			if (!sent.ok) {
				return sent;
			}
			const response = sent.value;
			if (response.status === 402) {
				return {
					ok: false,
					error: `payment failed: ${failureReason(response)}`,
				};
			}
			if (response.status === 409) {
				const code = await errorCode(response);
				return code === "draft_paid" || code === "payment_in_progress"
					? { ok: true, value: { outcome: PayOutcome.AlreadyPaid } }
					: { ok: false, error: `payment refused: ${code}` };
			}
			if (response.status !== 201) {
				return {
					ok: false,
					error: `payment refused: ${await errorCode(response)}`,
				};
			}
			return parsePaid(await response.json().catch(() => undefined));
		},
	};
};
