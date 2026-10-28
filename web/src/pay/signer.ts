import {
	type Address,
	address,
	assertIsSignatureBytes,
	getTransactionEncoder,
} from "@solana/kit";
import { VersionedTransaction } from "@solana/web3.js";
import type { ClientSvmSigner } from "@x402/svm";
import type { PhantomProvider } from "./types";

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
				const signed = await phantom.signTransaction(unsigned);
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
