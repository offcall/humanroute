import { VersionedTransaction } from "@solana/web3.js";
import { isRecord } from "../shared";
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
			const signed: unknown = await Reflect.apply(signTransaction, provider, [
				tx,
			]);
			if (!(signed instanceof VersionedTransaction)) {
				throw new Error("Phantom returned an invalid transaction");
			}

			return signed;
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
