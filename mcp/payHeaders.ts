// Reads the x402 headers of the gateway's answers: the 402 offer and the failure reason.
import { parsePaymentRequired } from "@x402/core/schemas";
import type { Offer } from "./payTypes.js";
import type { Parsed } from "./types.js";

const decodeHeader = (value: string | null): unknown => {
	if (value === null) {
		return undefined;
	}
	try {
		return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
	} catch {
		return undefined;
	}
};

export const readOffer = (response: Response): Parsed<Offer> => {
	const parsed = parsePaymentRequired(
		decodeHeader(response.headers.get("PAYMENT-REQUIRED")),
	);
	if (!parsed.success || parsed.data.x402Version !== 2) {
		return {
			ok: false,
			error: "gateway sent no readable x402 v2 payment offer",
		};
	}
	const accepted = parsed.data.accepts.find(
		(offer) => offer.scheme === "exact",
	);
	if (accepted === undefined) {
		return { ok: false, error: "gateway offers no exact payment" };
	}
	return { ok: true, value: { accepted, resource: parsed.data.resource } };
};

export const fieldOf = (value: unknown, key: string): string | undefined => {
	const field =
		typeof value === "object" && value !== null
			? Reflect.get(value, key)
			: undefined;
	return typeof field === "string" && field !== "" ? field : undefined;
};

// The x402 server puts a failed verify in PAYMENT-REQUIRED.error and a failed settle in PAYMENT-RESPONSE.
export const failureReason = (response: Response): string =>
	fieldOf(
		decodeHeader(response.headers.get("PAYMENT-RESPONSE")),
		"errorReason",
	) ??
	fieldOf(decodeHeader(response.headers.get("PAYMENT-REQUIRED")), "error") ??
	"unknown reason";
