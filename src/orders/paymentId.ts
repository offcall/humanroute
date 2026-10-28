// Payment identity (ADR 0004): sha256 of the Solana transaction message bytes inside PAYMENT-SIGNATURE.
// Signatures are excluded, so a re-serialised header or the facilitator's fee-payer signature
// slot does not change the identity of the same payment.
import { createHash } from "node:crypto";
import { VersionedTransaction } from "@solana/web3.js";
import { decodePaymentSignatureHeader } from "@x402/core/http";

export const paymentHeader = (
	get: (name: string) => string | undefined,
): string | undefined => get("payment-signature") ?? get("x-payment");

export const paymentId = (header: string | undefined): string | null => {
	if (!header) {
		return null;
	}
	try {
		const txn = decodePaymentSignatureHeader(header).payload.transaction;
		if (typeof txn !== "string") {
			return null;
		}
		const message = VersionedTransaction.deserialize(
			Buffer.from(txn, "base64"),
		).message.serialize();
		return createHash("sha256").update(message).digest("hex");
	} catch {
		return null;
	}
};
