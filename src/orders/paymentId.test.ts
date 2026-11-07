// Payment identity (ADR 0004): the hash of the transaction message, nothing else.
import { VersionedTransaction } from "@solana/web3.js";
import { describe, expect, test } from "vitest";
import {
	createDraft,
	createTestGateway,
	paymentFor,
	registerFirm,
	textField,
	WALLETS,
} from "../testing/index.js";
import { isRecord } from "./body.js";
import { paymentHeader, paymentId } from "./paymentId.js";

const base64 = (text: string) => Buffer.from(text).toString("base64");

const genuineHeader = async (memo: string): Promise<string> => {
	const { app } = createTestGateway();
	const firm = await registerFirm(app, WALLETS.firm);
	const draftId = textField(await createDraft(app, firm.mcpToken), "draftId");
	return paymentFor(app, draftId, WALLETS.firm, memo);
};

const decoded = (header: string): Record<string, unknown> => {
	const raw: unknown = JSON.parse(Buffer.from(header, "base64").toString());
	if (!isRecord(raw) || !isRecord(raw.payload)) {
		throw new Error("not a payment header");
	}
	return raw;
};

// The same message with a filled fee-payer signature slot and the JSON keys in reverse order.
const resigned = (header: string): string => {
	const raw = decoded(header);
	const payload = isRecord(raw.payload) ? raw.payload : {};
	const tx = VersionedTransaction.deserialize(
		Buffer.from(String(payload.transaction), "base64"),
	);
	tx.signatures[0] = new Uint8Array(64).fill(7);
	const transaction = Buffer.from(tx.serialize()).toString("base64");
	const reversed = Object.fromEntries(
		Object.entries({ ...raw, payload: { transaction } }).reverse(),
	);
	return base64(JSON.stringify(reversed));
};

describe("payment id", () => {
	test("malformed payment headers fail closed and legacy header normalization preserves message identity", async () => {
		const header = await genuineHeader("a");
		const raw = decoded(header);
		const malformed = [
			undefined,
			"",
			"%%%",
			base64("{oops"),
			base64(JSON.stringify({ ...raw, payload: {} })),
			base64(JSON.stringify({ ...raw, payload: { transaction: 7 } })),
			base64(JSON.stringify({ ...raw, payload: { transaction: "AAAA" } })),
		];
		for (const bad of malformed) {
			expect(paymentId(bad)).toBeNull();
		}

		const id = paymentId(header);
		expect(id).toMatch(/^[0-9a-f]{64}$/);
		expect(paymentId(resigned(header))).toBe(id);
		expect(paymentId(await genuineHeader("b"))).not.toBe(id);

		const both: Record<string, string> = {
			"payment-signature": "new",
			"x-payment": "legacy",
		};
		expect(paymentHeader((name) => both[name])).toBe("new");
		expect(
			paymentHeader((name) => (name === "x-payment" ? "legacy" : undefined)),
		).toBe("legacy");
	});
});
