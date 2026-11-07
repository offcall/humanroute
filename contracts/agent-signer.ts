// Agent-side contract support (ADR 0036, 0040): web/public/agent/*.mjs run as real child processes
// with a temp HOME, and messages built by the gateway's own builder or mutated from it.
import { spawnSync } from "node:child_process";
import { createPublicKey, verify } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
	type MessageCompiledInstruction,
	MessageV0,
	PublicKey,
} from "@solana/web3.js";
import { expect } from "vitest";
import {
	buildUnsignedTx,
	type UnsignedInput,
} from "../src/orders/unsignedTx.js";
import {
	FAKE_BLOCKHASH,
	type TestWallet,
	testConfig,
	WALLETS,
} from "../src/testing/index.js";

export const AGENT_DIR = join(import.meta.dirname, "../web/public/agent");
// DER prefix of an Ed25519 SubjectPublicKeyInfo; the 32 raw key bytes follow.
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export const MINT = testConfig().usdcMint;

export const ataOf = (owner: string, mint = MINT) =>
	getAssociatedTokenAddressSync(
		new PublicKey(mint),
		new PublicKey(owner),
	).toBase58();

// What setup.mjs writes for the test firm paying the test hold wallet.
export const SIGNER_CONFIG = {
	source: ataOf(WALLETS.firm.address),
	destination: ataOf(WALLETS.hold.address),
	mint: MINT,
};

export const PAYMENT: UnsignedInput = {
	firmWallet: WALLETS.firm.address,
	delegate: WALLETS.agent.address,
	feePayer: WALLETS.facilitator.address,
	mint: MINT,
	payTo: WALLETS.hold.address,
	amountUnits: 1_000_000n,
	blockhash: FAKE_BLOCKHASH,
};

// The message bytes of the gateway's own builder (src/orders/unsignedTx.ts).
export const gatewayMessage = (change: Partial<UnsignedInput> = {}): Buffer =>
	Buffer.from(buildUnsignedTx({ ...PAYMENT, ...change }).message, "base64");

export type MessageParts = {
	header: MessageV0["header"];
	keys: PublicKey[];
	instructions: MessageCompiledInstruction[];
	lookups: MessageV0["addressTableLookups"];
};

// Decodes a v0 message, applies a change to its compiled parts and encodes it again.
export const recompile = (
	bytes: Buffer,
	change: (parts: MessageParts) => MessageParts,
): Buffer => {
	const message = MessageV0.deserialize(bytes);
	const parts = change({
		header: { ...message.header },
		keys: [...message.staticAccountKeys],
		instructions: message.compiledInstructions.map((ix) => ({
			...ix,
			accountKeyIndexes: [...ix.accountKeyIndexes],
			data: Uint8Array.from(ix.data),
		})),
		lookups: [...message.addressTableLookups],
	});
	const rebuilt = new MessageV0({
		header: parts.header,
		staticAccountKeys: parts.keys,
		recentBlockhash: message.recentBlockhash,
		compiledInstructions: parts.instructions,
		addressTableLookups: parts.lookups,
	});
	return Buffer.from(rebuilt.serialize());
};

// Replaces instruction `at` (0 limit, 1 price, 2 transfer, 3 memo) with the result of `change`.
export const withInstruction =
	(
		at: number,
		change: (ix: MessageCompiledInstruction) => MessageCompiledInstruction,
	) =>
	(parts: MessageParts): MessageParts => ({
		...parts,
		instructions: parts.instructions.map((ix, index) =>
			index === at ? change(ix) : ix,
		),
	});

export const dataOf =
	(bytes: number[] | Buffer) => (ix: MessageCompiledInstruction) => ({
		...ix,
		data: Uint8Array.from(bytes),
	});

export const u32Data = (tag: number, value: number) => {
	const data = Buffer.alloc(5);
	data[0] = tag;
	data.writeUInt32LE(value, 1);
	return data;
};

export const u64Data = (tag: number, value: bigint, extra: number[] = []) => {
	const data = Buffer.alloc(9);
	data[0] = tag;
	data.writeBigUInt64LE(value, 1);
	return Buffer.concat([data, Buffer.from(extra)]);
};

export type ScriptRun = {
	status: number | null;
	stdout: string;
	stderr: string;
};

export const runScript = (
	home: string,
	script: string,
	args: string[],
): ScriptRun => {
	const run = spawnSync(process.execPath, [join(AGENT_DIR, script), ...args], {
		env: { PATH: process.env.PATH ?? "", HOME: home },
		encoding: "utf8",
	});
	return { status: run.status, stdout: run.stdout, stderr: run.stderr };
};

export type AgentHome = {
	home: string;
	sign: (message: string) => ScriptRun;
	remove: () => void;
};

export const tempHome = () => mkdtempSync(join(tmpdir(), "hr-agent-"));

// A HOME with ~/.humanroute holding the agent key file and config.json, as setup.mjs leaves them.
export const agentHome = (
	files: { key?: string; config?: string; agent?: TestWallet } = {},
): AgentHome => {
	const home = tempHome();
	const dir = join(home, ".humanroute");
	mkdirSync(dir, { mode: 0o700 });
	const secret = (files.agent ?? WALLETS.agent).keypair.secretKey;
	const key = files.key ?? JSON.stringify([...secret]);
	writeFileSync(join(dir, "agent-key.json"), key, { mode: 0o600 });
	const config = files.config ?? JSON.stringify(SIGNER_CONFIG);
	writeFileSync(join(dir, "config.json"), config, { mode: 0o600 });
	return {
		home,
		sign: (message) => runScript(home, "sign.mjs", [message]),
		remove: () => rmSync(home, { recursive: true, force: true }),
	};
};

export const verifies = (
	message: Buffer,
	signature: Buffer,
	address: string,
): boolean => {
	const key = createPublicKey({
		key: Buffer.concat([SPKI_PREFIX, new PublicKey(address).toBuffer()]),
		format: "der",
		type: "spki",
	});
	return verify(null, message, key, signature);
};

// sign.mjs signed: exit 0 and only a valid signature by `address` over the message on stdout.
export const expectSigned = (
	run: ScriptRun,
	message: Buffer,
	address = WALLETS.agent.address,
) => {
	expect(run.stderr).not.toContain("refused");
	expect(run.status).toBe(0);
	const signature = Buffer.from(run.stdout.trim(), "base64");
	expect(run.stdout).toBe(`${signature.toString("base64")}\n`);
	expect(signature).toHaveLength(64);
	expect(verifies(message, signature, address)).toBe(true);
	return signature;
};

// sign.mjs refused (ADR 0040): exit 1, nothing on stdout, the reason on stderr.
export const expectRefused = (run: ScriptRun, reason: string) => {
	expect(run.stdout).toBe("");
	expect(run.status).toBe(1);
	expect(run.stderr).toContain(`sign.mjs refused: ${reason}`);
};

// Instruction positions in the gateway message: compute limit, compute price, transfer, memo.
export const LIMIT = 0;
export const PRICE = 1;
export const TRANSFER = 2;
export const MEMO = 3;

export const NOT_OURS = "this is not a HumanRoute payment for this agent key";
