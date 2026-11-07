import { VersionedTransaction } from "@solana/web3.js";
import { describe, expect, test } from "vitest";
import { AGENT, offerFor, signMessage, unsignedFor } from "./fakePayment.js";
import { nth } from "./fakes.js";
import type { Prepared } from "./payTypes.js";
import { signedTransaction } from "./signature.js";

const preparedOf = (extra: Partial<Prepared> = {}): Prepared => ({
	...unsignedFor(),
	...offerFor(),
	expiresAt: 120_000,
	...extra,
});

describe("signedTransaction", () => {
	test("puts a valid signature into the agent's slot", () => {
		const prepared = preparedOf();
		const signature = signMessage(prepared.message);

		const signed = signedTransaction(prepared, signature);

		expect(signed.ok).toBe(true);
		if (!signed.ok) {
			return;
		}
		const transaction = VersionedTransaction.deserialize(
			Buffer.from(signed.value, "base64"),
		);
		expect(Buffer.from(nth(transaction.signatures, 1)).toString("base64")).toBe(
			signature,
		);
		expect(nth(transaction.signatures, 0).every((byte) => byte === 0)).toBe(
			true,
		);
	});

	test("a signature over one message cannot be attached to a different prepared transaction", () => {
		const signedMessage = unsignedFor("2000000").message;
		const otherTransaction = unsignedFor("9000000").transaction;
		const prepared = preparedOf({
			message: signedMessage,
			transaction: otherTransaction,
		});

		const signed = signedTransaction(prepared, signMessage(signedMessage));

		expect(signed).toEqual({
			ok: false,
			error: expect.stringContaining("does not match the message you signed"),
		});
	});

	test.each([
		["a malformed signer key", { signer: "not-a-key" }],
		["a malformed transaction", { transaction: "AAAA" }],
		[
			"a transaction where the agent is not a signer",
			{
				transaction: unsignedFor("2000000", AGENT.publicKey).transaction.slice(
					0,
					40,
				),
			},
		],
	])("%s gives a typed refusal, not an exception", (_name, extra) => {
		const prepared = preparedOf(extra);

		const signed = signedTransaction(prepared, signMessage(prepared.message));

		expect(signed).toEqual({
			ok: false,
			error: expect.stringContaining("unreadable"),
		});
	});
});
