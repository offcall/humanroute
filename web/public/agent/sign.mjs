// HumanRoute agent signer (ADR 0036). Node built-ins only; the key never leaves this machine.
// Usage: node ~/.humanroute/sign.mjs <base64 message from prepare_payment>
// Signs only a HumanRoute x402 payment: compute limit, compute price, one USDC TransferChecked
// from the firm's account to HumanRoute's account with this key as authority, and a memo.
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const HOME_DIR = join(homedir(), ".humanroute");
export const KEY_FILE = join(HOME_DIR, "agent-key.json");
export const CONFIG_FILE = join(HOME_DIR, "config.json");

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const COMPUTE_BUDGET = "ComputeBudget111111111111111111111111111111";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const USDC_DECIMALS = 6;

export const base58 = (bytes) => {
	let value = BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`);
	let text = "";
	while (value > 0n) {
		text = ALPHABET[Number(value % 58n)] + text;
		value /= 58n;
	}
	const zeros = bytes.findIndex((byte) => byte !== 0);
	return "1".repeat(zeros === -1 ? bytes.length : zeros) + text;
};

// Solana compact-u16 length prefix: [value, next offset].
const readLength = (bytes, start) => {
	let value = 0;
	for (let index = 0; index < 3; index += 1) {
		const byte = bytes[start + index];
		value |= (byte & 0x7f) << (7 * index);
		if ((byte & 0x80) === 0) {
			return [value, start + index + 1];
		}
	}
	throw new Error("bad length prefix");
};

const parseMessage = (bytes) => {
	if (bytes[0] !== 0x80) {
		throw new Error("not a v0 transaction message");
	}
	const signerCount = bytes[1];
	let [count, offset] = readLength(bytes, 4);
	const keys = [];
	for (let index = 0; index < count; index += 1, offset += 32) {
		keys.push(base58(bytes.subarray(offset, offset + 32)));
	}
	[count, offset] = readLength(bytes, offset + 32);
	const instructions = [];
	for (let index = 0; index < count; index += 1) {
		const program = keys[bytes[offset]];
		let size;
		[size, offset] = readLength(bytes, offset + 1);
		const accounts = [...bytes.subarray(offset, offset + size)].map(
			(at) => keys[at],
		);
		[size, offset] = readLength(bytes, offset + size);
		instructions.push({
			program,
			accounts,
			data: bytes.subarray(offset, offset + size),
		});
		offset += size;
	}
	if (readLength(bytes, offset)[0] !== 0) {
		throw new Error("address lookup tables are not allowed");
	}
	return { signers: keys.slice(0, signerCount), instructions };
};

// Returns the amount in base units, or throws when the message is not a HumanRoute payment.
export const checkPayment = (message, config, agent) => {
	const { signers, instructions } = parseMessage(message);
	const programs = instructions.map((ix) => ix.program).join(",");
	const expected = [
		COMPUTE_BUDGET,
		COMPUTE_BUDGET,
		TOKEN_PROGRAM,
		MEMO_PROGRAM,
	].join(",");
	if (programs !== expected || !signers.includes(agent)) {
		throw new Error("this is not a HumanRoute payment for this agent key");
	}
	const [limit, price, transfer] = instructions;
	if (
		limit.data[0] !== 2 ||
		price.data[0] !== 3 ||
		transfer.data[0] !== 12 ||
		transfer.data.length !== 10
	) {
		throw new Error("unexpected instruction data");
	}
	const [source, mint, destination, authority] = transfer.accounts;
	const pinned = [config.source, config.mint, config.destination, agent];
	if ([source, mint, destination, authority].join(",") !== pinned.join(",")) {
		throw new Error(
			"the transfer is not from your USDC account to HumanRoute with this key",
		);
	}
	if (transfer.data[9] !== USDC_DECIMALS) {
		throw new Error("unexpected token decimals");
	}
	return Buffer.from(transfer.data).readBigUInt64LE(1);
};

export const readKey = () =>
	Uint8Array.from(JSON.parse(readFileSync(KEY_FILE, "utf8")));

const main = (encoded) => {
	const secret = readKey();
	const agent = base58(secret.subarray(32, 64));
	const config = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
	const message = Buffer.from(encoded ?? "", "base64");
	const units = checkPayment(message, config, agent);
	const usdc = `${units / 1_000_000n}.${(units % 1_000_000n).toString().padStart(6, "0")}`;
	console.error(
		`Signing a HumanRoute payment of ${usdc} USDC with agent key ${agent}`,
	);
	const key = createPrivateKey({
		key: Buffer.concat([PKCS8_PREFIX, secret.subarray(0, 32)]),
		format: "der",
		type: "pkcs8",
	});
	console.log(sign(null, message, key).toString("base64"));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	try {
		main(process.argv[2]);
	} catch (error) {
		console.error(
			`sign.mjs refused: ${error instanceof Error ? error.message : error}`,
		);
		process.exit(1);
	}
}
