// MCP auto-pay test support (ADR 0037): deterministic keys, a real unsigned v0 payment, the
// gateway's offer, a local signer and a scriptable PayClient. Imported only by mcp/*.test.ts.
import { createPrivateKey, sign } from "node:crypto";
import {
	Keypair,
	PublicKey,
	SystemProgram,
	TransactionMessage,
	VersionedTransaction,
} from "@solana/web3.js";
import type { Offer, PayClient, Unsigned } from "./payTypes.js";
import type { Parsed } from "./types.js";

const keyFrom = (byte: number) =>
	Keypair.fromSeed(new Uint8Array(32).fill(byte));

export const AGENT = keyFrom(1);
export const OTHER_AGENT = keyFrom(4);
export const FEE_PAYER = keyFrom(2).publicKey;
export const PAY_TO = keyFrom(3).publicKey;
const BLOCKHASH = new PublicKey(new Uint8Array(32).fill(9)).toBase58();
const ASSET = keyFrom(5).publicKey.toBase58();
export const AMOUNT = "2000000";

const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

// A real v0 transaction: fee payer first, the agent key as the second required signer.
export const unsignedFor = (
	amount = AMOUNT,
	signer = AGENT.publicKey,
): Unsigned => {
	const message = new TransactionMessage({
		payerKey: FEE_PAYER,
		recentBlockhash: BLOCKHASH,
		instructions: [
			SystemProgram.transfer({
				fromPubkey: signer,
				toPubkey: PAY_TO,
				lamports: BigInt(amount),
			}),
		],
	}).compileToV0Message();
	return {
		transaction: base64(new VersionedTransaction(message).serialize()),
		message: base64(message.serialize()),
		signer: signer.toBase58(),
		amountUnits: amount,
		payTo: PAY_TO.toBase58(),
	};
};

export const offerFor = (
	amount = AMOUNT,
	extra: Record<string, unknown> = { feePayer: FEE_PAYER.toBase58() },
): Offer => ({
	accepted: {
		scheme: "exact",
		network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
		amount,
		asset: ASSET,
		payTo: PAY_TO.toBase58(),
		maxTimeoutSeconds: 60,
		extra,
	},
	resource: { url: "https://gateway.test/x/orders/drf_1" },
});

// PKCS8 DER prefix of an Ed25519 private key; the 32-byte seed follows.
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

// What sign.mjs prints: the base64 ed25519 signature over the base64 message.
export const signMessage = (message: string, keypair = AGENT) =>
	sign(
		null,
		Buffer.from(message, "base64"),
		createPrivateKey({
			key: Buffer.concat([PKCS8_PREFIX, keypair.secretKey.subarray(0, 32)]),
			format: "der",
			type: "pkcs8",
		}),
	).toString("base64");

export type PayCall = { method: string; args: unknown[] };

const unexpected = (method: string) => async (): Promise<Parsed<never>> => {
	throw new Error(`unexpected pay client call: ${method}`);
};

export const fakePayClient = (script: Partial<PayClient> = {}) => {
	const calls: PayCall[] = [];
	const client: PayClient = {
		offer: async (...args) => {
			calls.push({ method: "offer", args });
			return (script.offer ?? unexpected("offer"))(...args);
		},
		unsigned: async (...args) => {
			calls.push({ method: "unsigned", args });
			return (script.unsigned ?? unexpected("unsigned"))(...args);
		},
		pay: async (...args) => {
			calls.push({ method: "pay", args });
			return (script.pay ?? unexpected("pay"))(...args);
		},
	};
	return { client, calls };
};
