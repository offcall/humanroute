// SIWS sign-in (api.md): nonce, Ed25519 signature over the message bytes, session cookie.
import { type KeyPairSigner, signBytes } from "@solana/kit";
import { call, type Jar, stringField } from "./http.js";

export const signIn = async (
	gateway: string,
	signer: KeyPairSigner,
): Promise<Jar> => {
	const jar: Jar = new Map();
	const wallet = signer.address;
	const challenge = await call(gateway, "POST", "/api/auth/nonce", "nonce", {
		body: { wallet },
	});
	const message = new TextEncoder().encode(stringField(challenge, "message"));
	const signature = Buffer.from(
		await signBytes(signer.keyPair.privateKey, message),
	).toString("base64");
	await call(gateway, "POST", "/api/auth/verify", "verify", {
		jar,
		body: { wallet, nonce: stringField(challenge, "nonce"), signature },
	});
	console.log(`signed in ${wallet}`);
	return jar;
};
