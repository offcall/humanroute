// Solana wallets from fixed seeds, so addresses never change between runs, and Ed25519 signing for SIWS.
import { createPrivateKey, sign } from "node:crypto";
import { Keypair } from "@solana/web3.js";

// DER prefix of an Ed25519 PKCS#8 private key; the 32-byte seed follows.
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export type TestWallet = {
	address: string;
	keypair: Keypair;
	// Base64 Ed25519 signature over the UTF-8 text, as Phantom signMessage returns it.
	signText: (text: string) => string;
};

export const testWallet = (seedByte: number): TestWallet => {
	const seed = new Uint8Array(32).fill(seedByte);
	const keypair = Keypair.fromSeed(seed);
	const privateKey = createPrivateKey({
		key: Buffer.concat([PKCS8_PREFIX, seed]),
		format: "der",
		type: "pkcs8",
	});

	return {
		address: keypair.publicKey.toBase58(),
		keypair,
		signText: (text) =>
			sign(null, Buffer.from(text, "utf8"), privateKey).toString("base64"),
	};
};

// One wallet per role.
export const WALLETS = {
	hold: testWallet(1),
	fee: testWallet(2),
	firm: testWallet(3),
	agency: testWallet(4),
	linguist: testWallet(5),
	agent: testWallet(6),
	facilitator: testWallet(7),
};
