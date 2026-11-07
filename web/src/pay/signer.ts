import {
	type Address,
	address,
	assertIsSignatureBytes,
	getTransactionEncoder,
} from "@solana/kit";
import { VersionedTransaction } from "@solana/web3.js";
import type { ClientSvmSigner } from "@x402/svm";
import type { PhantomProvider } from "./types";

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
	left.length === right.length && left.every((byte, at) => byte === right[at]);

export const createPhantomSigner = (
	phantom: PhantomProvider,
	walletAddress: string,
): ClientSvmSigner => {
	const signerAddress: Address = address(walletAddress);
	const encoder = getTransactionEncoder();

	return {
		address: signerAddress,
		signTransactions: async (transactions) => {
			const dictionaries = [];
			for (const transaction of transactions) {
				const unsigned = VersionedTransaction.deserialize(
					Uint8Array.from(encoder.encode(transaction)),
				);
				// Captured before the call: Phantom may return the same object, changed in place.
				const messageBytes = unsigned.message.serialize();
				const signed = await phantom.signTransaction(unsigned);
				// x402 sends its own message with this signature, so a changed message cannot verify.
				if (!sameBytes(signed.message.serialize(), messageBytes)) {
					throw new Error(
						"Phantom changed the transaction before signing; its signature would not verify",
					);
				}
				const index = signed.message.staticAccountKeys.findIndex(
					(key) => key.toBase58() === walletAddress,
				);
				const signature = signed.signatures[index];
				if (index < 0 || signature === undefined) {
					throw new Error("Phantom returned no signature for this wallet");
				}
				assertIsSignatureBytes(signature);
				dictionaries.push({ [signerAddress]: signature });
			}

			return dictionaries;
		},
	};
};
