// Parses the PAYMENT-RESPONSE header (base64 JSON SettleResponse) without trusting its shape.
import { base58 } from "@scure/base";
import { isRecord } from "./body.js";
import {
	OrphanReason,
	type Settlement,
	type SettlePeek,
	type SettleRejection,
} from "./types.js";

const decode = (header: string): unknown => {
	try {
		return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
	} catch {
		return undefined;
	}
};

const field = (raw: unknown, key: string): string | null => {
	if (!isRecord(raw)) {
		return null;
	}
	const value = raw[key];
	return typeof value === "string" && value !== "" ? value : null;
};

export const peekSettle = (header: string): SettlePeek => {
	const raw = decode(header);
	return {
		transaction: field(raw, "transaction"),
		payer: field(raw, "payer"),
		network: field(raw, "network"),
	};
};

export const isPublicKey = (value: string): boolean => {
	try {
		return base58.decode(value).length === 32;
	} catch {
		return false;
	}
};

const unparsable = (error: string): SettleRejection => ({
	reason: OrphanReason.UnparsableSettle,
	error,
});

export const parseSettleHeader = (
	header: string,
	expectedNetwork: string,
): Settlement | SettleRejection => {
	const raw = decode(header);
	if (raw === undefined) {
		return unparsable("PAYMENT-RESPONSE is not base64 JSON");
	}
	if (!isRecord(raw)) {
		return unparsable("PAYMENT-RESPONSE is not an object");
	}
	const { success, transaction, payer, network } = raw;
	if (success !== true) {
		return unparsable("settlement did not succeed");
	}
	if (typeof transaction !== "string" || transaction === "") {
		return unparsable("settlement has no transaction");
	}
	if (typeof network !== "string") {
		return unparsable("settlement has no network");
	}
	if (network !== expectedNetwork) {
		const error = `settlement on unexpected network ${network}`;
		return { reason: OrphanReason.WrongNetwork, error };
	}
	// The payer becomes the refund wallet of every task (ADR 0016, ADR 0022).
	if (typeof payer !== "string" || !isPublicKey(payer)) {
		const error = "settlement payer is not a base58 public key";
		return { reason: OrphanReason.InvalidPayer, error };
	}
	return { transaction, payer, network };
};
