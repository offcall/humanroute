// Checks the agent's ed25519 signature over the stored message and puts it into the transaction.
import { createPublicKey, verify } from "node:crypto";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import type { Prepared } from "./payTypes.js";
import type { Parsed } from "./types.js";

const SIGNATURE_BYTES = 64;
// DER prefix of an Ed25519 SubjectPublicKeyInfo; the 32 raw key bytes follow.
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export const signedTransaction = (
	prepared: Prepared,
	signatureBase64: string,
): Parsed<string> => {
	const signature = Buffer.from(signatureBase64.trim(), "base64");
	if (signature.length !== SIGNATURE_BYTES) {
		return {
			ok: false,
			error:
				"the signature is not 64 bytes of base64: copy the whole output of sign.mjs",
		};
	}
	const signer = new PublicKey(prepared.signer);
	const key = createPublicKey({
		key: Buffer.concat([SPKI_PREFIX, signer.toBuffer()]),
		format: "der",
		type: "spki",
	});
	if (!verify(null, Buffer.from(prepared.message, "base64"), key, signature)) {
		return {
			ok: false,
			error: `the signature does not match: auto-pay is set for key ${prepared.signer}, sign with that key (~/.humanroute/agent-key.json) or enable auto-pay for your key in the firm cabinet`,
		};
	}
	const transaction = VersionedTransaction.deserialize(
		Buffer.from(prepared.transaction, "base64"),
	);
	transaction.addSignature(signer, signature);
	return {
		ok: true,
		value: Buffer.from(transaction.serialize()).toString("base64"),
	};
};
