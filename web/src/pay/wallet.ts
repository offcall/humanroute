import { VersionedTransaction } from "@solana/web3.js";
import { isRecord } from "../shared";
import { phantomError } from "./phantomError";
import { createPhantomSigner } from "./signer";
import type { Parsed, PhantomProvider } from "./types";

export const getPhantom = (): PhantomProvider | undefined => {
	const holder: unknown = Reflect.get(window, "phantom");
	if (!isRecord(holder)) {
		return undefined;
	}
	const provider = holder.solana;
	if (!isRecord(provider) || provider.isPhantom !== true) {
		return undefined;
	}
	const { connect, signTransaction } = provider;
	if (typeof connect !== "function" || typeof signTransaction !== "function") {
		return undefined;
	}

	return {
		connect: async () => {
			const result: unknown = await Reflect.apply(connect, provider, []);
			if (!isRecord(result) || !isRecord(result.publicKey)) {
				throw new Error("Phantom returned no public key");
			}
			const key = String(result.publicKey);

			return { publicKey: { toString: () => key } };
		},
		signTransaction: async (tx) => {
			let signed: unknown;
			try {
				signed = await Reflect.apply(signTransaction, provider, [tx]);
			} catch (error) {
				throw phantomError(error);
			}
			// Phantom builds the result with its own web3.js copy, so `instanceof` fails;
			// re-read its wire bytes with ours instead.
			if (signed instanceof VersionedTransaction) {
				return signed;
			}
			if (!isRecord(signed) || typeof signed.serialize !== "function") {
				throw new Error("Phantom returned an invalid transaction");
			}
			const bytes: unknown = Reflect.apply(signed.serialize, signed, []);
			if (!(bytes instanceof Uint8Array) && !ArrayBuffer.isView(bytes)) {
				throw new Error("Phantom returned an invalid transaction");
			}

			return VersionedTransaction.deserialize(
				new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
			);
		},
	};
};

export const connectPhantom = async (
	phantom: PhantomProvider,
): Promise<
	Parsed<{ address: string; signer: ReturnType<typeof createPhantomSigner> }>
> => {
	try {
		const response = await phantom.connect();
		const walletAddress = response.publicKey.toString();

		return {
			ok: true,
			value: {
				address: walletAddress,
				signer: createPhantomSigner(phantom, walletAddress),
			},
		};
	} catch {
		return { ok: false, error: "wallet connection was rejected" };
	}
};
