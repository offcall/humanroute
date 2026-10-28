import { isRecord } from "./parse";

export type Phantom = {
	connect: () => Promise<unknown>;
	signMessage: (message: Uint8Array) => Promise<unknown>;
};

export const getPhantom = (): Phantom | undefined => {
	const holder: unknown = Reflect.get(window, "phantom");
	if (!isRecord(holder)) {
		return undefined;
	}
	const provider = holder.solana;
	if (!isRecord(provider) || provider.isPhantom !== true) {
		return undefined;
	}
	const { connect, signMessage } = provider;
	if (typeof connect !== "function" || typeof signMessage !== "function") {
		return undefined;
	}

	return {
		connect: () => Reflect.apply(connect, provider, []),
		signMessage: (message) =>
			Reflect.apply(signMessage, provider, [message, "utf8"]),
	};
};

export const phantomDeepLink = (url: string): string =>
	`https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(window.location.origin)}`;

export const toBase64 = (bytes: Uint8Array): string => {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
};
