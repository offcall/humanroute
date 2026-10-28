// Wallet and signature decoding plus the Ed25519 check through node:crypto.
import { createPublicKey, verify } from "node:crypto";
import { base58 } from "@scure/base";

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export const decodeWallet = (wallet: string): Uint8Array | null => {
	try {
		const bytes = base58.decode(wallet);
		return bytes.length === 32 ? bytes : null;
	} catch {
		return null;
	}
};

export const decodeSignature = (signature: string): Uint8Array | null => {
	if (!BASE64.test(signature)) {
		return null;
	}
	const bytes = Buffer.from(signature, "base64");
	return bytes.length === 64 ? bytes : null;
};

export const verifyEd25519 = (
	publicKey: Uint8Array,
	message: string,
	signature: Uint8Array,
): boolean => {
	try {
		const key = createPublicKey({
			key: {
				kty: "OKP",
				crv: "Ed25519",
				x: Buffer.from(publicKey).toString("base64url"),
			},
			format: "jwk",
		});
		return verify(null, Buffer.from(message), key, signature);
	} catch {
		return false;
	}
};
