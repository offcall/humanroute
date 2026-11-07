// SIWS sign-in and the three roles through the cabinet routes (api.md).
import { createPrivateKey, sign } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import { call, type Jar, record, request, text } from "./http.js";

const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export type Firm = {
	key: Keypair;
	jar: Jar;
	firmId: string;
	mcpToken: string;
};
export type Agency = { key: Keypair; jar: Jar; agencyId: string; code: string };
export type Linguist = { key: Keypair; jar: Jar };
export type Pair = { source: string; target: string };

// Base64 Ed25519 signature over UTF-8 text, as Phantom signMessage returns it.
export const signText = (key: Keypair, message: string): string => {
	const privateKey = createPrivateKey({
		key: Buffer.concat([PKCS8_PREFIX, key.secretKey.subarray(0, 32)]),
		format: "der",
		type: "pkcs8",
	});
	return sign(null, Buffer.from(message, "utf8"), privateKey).toString(
		"base64",
	);
};

export const signIn = async (gateway: string, key: Keypair): Promise<Jar> => {
	const jar: Jar = new Map();
	const wallet = key.publicKey.toBase58();
	const challenge = await call(gateway, "POST", "/api/auth/nonce", {
		body: { wallet },
	});
	const signature = signText(key, text(challenge, "message"));
	const nonce = text(challenge, "nonce");
	await call(gateway, "POST", "/api/auth/verify", {
		jar,
		body: { wallet, nonce, signature },
	});
	return jar;
};

export const registerFirm = async (
	gateway: string,
	key: Keypair,
): Promise<Firm> => {
	const jar = await signIn(gateway, key);
	// A slot's wallet may already hold its firm from an earlier case of the same file.
	const created = await request(gateway, "POST", "/api/firm", {
		jar,
		body: { name: "E2E firm" },
	});
	if (created.status !== 201 && created.status !== 409) {
		throw new Error(`POST /api/firm: HTTP ${created.status}`);
	}
	const firm = await call(gateway, "GET", "/api/firm", { jar });
	return {
		key,
		jar,
		firmId: text(record(firm, "firm"), "id"),
		mcpToken: text(record(firm, "mcp"), "token"),
	};
};

export const registerAgency = async (gateway: string): Promise<Agency> => {
	const key = Keypair.generate();
	const jar = await signIn(gateway, key);
	await call(gateway, "POST", "/api/agency", {
		jar,
		body: { name: "E2E agency" },
	});
	const agency = await call(gateway, "GET", "/api/agency", { jar });
	const invite = await call(gateway, "POST", "/api/agency/invite", {
		jar,
		body: {},
	});
	return {
		key,
		jar,
		agencyId: text(record(agency, "agency"), "id"),
		code: text(invite, "code"),
	};
};

export const joinLinguist = async (
	gateway: string,
	agency: Agency,
	pairs: Pair[],
): Promise<Linguist> => {
	const key = Keypair.generate();
	const jar = await signIn(gateway, key);
	await call(gateway, "POST", `/api/linguist/join/${agency.code}`, {
		jar,
		body: {},
	});
	await call(gateway, "PUT", "/api/linguist/languages", {
		jar,
		body: { pairs },
	});
	return { key, jar };
};
