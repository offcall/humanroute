// Phantom signs AND sends approve and revoke (ADR 0036), on the network selected in Phantom.
import type { VersionedTransaction } from "@solana/web3.js";
import { isRecord } from "../shared";

export type SendResult =
	| { ok: true; signature: string }
	| { ok: false; error: string };

const reason = (error: unknown): string => {
	const message = isRecord(error) ? error.message : undefined;
	return typeof message === "string" ? message : String(error);
};

// The firm must sign with its login wallet: the allowance is on that wallet's USDC account.
export const sendWithPhantom = async (
	wallet: string,
	tx: VersionedTransaction,
): Promise<SendResult> => {
	const holder: unknown = Reflect.get(window, "phantom");
	const provider = isRecord(holder) ? holder.solana : undefined;
	if (!isRecord(provider) || provider.isPhantom !== true) {
		return {
			ok: false,
			error: "Phantom not found: open this page in a browser with Phantom",
		};
	}
	const { connect, signAndSendTransaction } = provider;
	if (
		typeof connect !== "function" ||
		typeof signAndSendTransaction !== "function"
	) {
		return { ok: false, error: "this Phantom cannot send transactions" };
	}
	try {
		const connected: unknown = await Reflect.apply(connect, provider, []);
		const key = isRecord(connected) ? String(connected.publicKey) : "";
		if (key !== wallet) {
			return {
				ok: false,
				error: `switch Phantom to your firm wallet ${wallet}`,
			};
		}
		const sent: unknown = await Reflect.apply(
			signAndSendTransaction,
			provider,
			[tx],
		);
		const signature = isRecord(sent) ? sent.signature : undefined;
		return typeof signature === "string"
			? { ok: true, signature }
			: { ok: false, error: "Phantom returned no signature" };
	} catch (error) {
		return {
			ok: false,
			error: `Phantom: ${reason(error)}. Is Phantom on Solana devnet (Settings, Developer settings, Testnet mode)?`,
		};
	}
};
