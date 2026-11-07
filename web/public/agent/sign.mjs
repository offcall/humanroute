// HumanRoute agent signer (ADR 0036, 0040). Node built-ins only; the key never leaves this machine.
// Usage: node ~/.humanroute/sign.mjs <base64 message from prepare_payment>
// Signs only a HumanRoute x402 payment: compute limit, compute price, one USDC TransferChecked
// from the firm's account to HumanRoute's account with this key as authority, and a memo.
// Fails closed (ADR 0040): any rule broken prints "sign.mjs refused: <reason>" and exits 1.
import { createPrivateKey, createPublicKey, sign } from "node:crypto";
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
const PROGRAMS = [COMPUTE_BUDGET, COMPUTE_BUDGET, TOKEN_PROGRAM, MEMO_PROGRAM];
const USDC_DECIMALS = 6;
const MAX_MESSAGE_BYTES = 1232;
const HEADER = "2,1,4";
const KEY_COUNT = 8;
const MAX_COMPUTE_LIMIT = 40_000;
const MAX_COMPUTE_PRICE = 1000n;
const MAX_MEMO_BYTES = 64;

const malformed = (what) => new Error(`malformed message: ${what}`);
const notOurs = () =>
	new Error("this is not a HumanRoute payment for this agent key");
const badFile = (what) => new Error(`bad key or config file: ${what}`);

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

// A cursor that never reads past the end of the buffer.
const reader = (bytes) => {
	let offset = 0;
	const take = (size) => {
		if (offset + size > bytes.length) {
			throw malformed("truncated");
		}
		offset += size;
		return bytes.subarray(offset - size, offset);
	};
	const byte = () => take(1)[0];
	// Solana compact-u16: at most 3 bytes, no redundant zero byte, value <= 0xffff.
	const length = () => {
		let value = 0;
		for (let index = 0; index < 3; index += 1) {
			const next = byte();
			value |= (next & 0x7f) << (7 * index);
			if ((next & 0x80) === 0) {
				if ((index > 0 && next === 0) || value > 0xffff) {
					throw malformed("non-canonical length");
				}
				return value;
			}
		}
		throw malformed("length prefix longer than 3 bytes");
	};
	return { take, byte, length, done: () => offset === bytes.length };
};

const parseMessage = (bytes) => {
	const read = reader(bytes);
	if (read.byte() !== 0x80) {
		throw malformed("not a v0 transaction message");
	}
	const header = [...read.take(3)];
	const keys = [];
	for (let count = read.length(); keys.length < count; ) {
		keys.push(base58(read.take(32)));
	}
	read.take(32);
	const instructions = [];
	for (let count = read.length(); instructions.length < count; ) {
		const programAt = read.byte();
		const accountsAt = [...read.take(read.length())];
		const data = read.take(read.length());
		if ([programAt, ...accountsAt].some((at) => at >= keys.length)) {
			throw malformed("key index out of range");
		}
		instructions.push({ programAt, accountsAt, data });
	}
	if (read.length() !== 0) {
		throw malformed("address lookup tables are not allowed");
	}
	if (!read.done()) {
		throw malformed("trailing bytes");
	}
	return { header, keys, instructions };
};

const checkCompute = (limit, price) => {
	if (limit.data.length !== 5 || limit.data[0] !== 2) {
		throw notOurs();
	}
	if (price.data.length !== 9 || price.data[0] !== 3) {
		throw notOurs();
	}
	const units = limit.data.readUInt32LE(1);
	if (units > MAX_COMPUTE_LIMIT) {
		throw new Error(`compute limit ${units} above ${MAX_COMPUTE_LIMIT}`);
	}
	const microLamports = price.data.readBigUInt64LE(1);
	if (microLamports > MAX_COMPUTE_PRICE) {
		throw new Error(
			`compute price ${microLamports} above ${MAX_COMPUTE_PRICE}`,
		);
	}
};

const isUtf8 = (data) => {
	try {
		new TextDecoder("utf-8", { fatal: true }).decode(data);
		return true;
	} catch {
		return false;
	}
};

// Returns the amount in base units, or throws when the message is not a HumanRoute payment.
export const checkPayment = (message, config, agent) => {
	const { header, keys, instructions } = parseMessage(Buffer.from(message));
	if (keys[0] === agent) {
		throw new Error("the agent key must not pay the fee");
	}
	const programs = instructions.map((ix) => keys[ix.programAt]);
	if (
		header.join(",") !== HEADER ||
		keys.length !== KEY_COUNT ||
		new Set(keys).size !== KEY_COUNT ||
		keys[1] !== agent ||
		programs.join(",") !== PROGRAMS.join(",") ||
		instructions.some((ix) => ix.programAt < header[0])
	) {
		throw notOurs();
	}
	const [limit, price, transfer, memo] = instructions;
	if ([limit, price, memo].some((ix) => ix.accountsAt.length > 0)) {
		throw notOurs();
	}
	checkCompute(limit, price);
	const accounts = transfer.accountsAt.map((at) => keys[at]).join(",");
	const pinned = [config.source, config.mint, config.destination, agent];
	const { data } = transfer;
	if (
		accounts !== pinned.join(",") ||
		data.length !== 10 ||
		data[0] !== 12 ||
		data[9] !== USDC_DECIMALS ||
		data.readBigUInt64LE(1) === 0n
	) {
		throw notOurs();
	}
	if (memo.data.length < 1 || memo.data.length > MAX_MEMO_BYTES) {
		throw notOurs();
	}
	if (!isUtf8(memo.data)) {
		throw notOurs();
	}
	return data.readBigUInt64LE(1);
};

const readJson = (file) => {
	try {
		return JSON.parse(readFileSync(file, "utf8"));
	} catch {
		throw badFile(`cannot read ${file}`);
	}
};

const publicKeyOf = (seed) =>
	createPublicKey(
		createPrivateKey({
			key: Buffer.concat([PKCS8_PREFIX, seed]),
			format: "der",
			type: "pkcs8",
		}),
	)
		.export({ format: "der", type: "spki" })
		.subarray(-32);

// 64 bytes: the Ed25519 seed, then its public key.
export const readKey = () => {
	const raw = readJson(KEY_FILE);
	const isByte = (item) => Number.isInteger(item) && item >= 0 && item <= 255;
	if (!Array.isArray(raw) || raw.length !== 64 || !raw.every(isByte)) {
		throw badFile("the key is not 64 bytes");
	}
	const secret = Uint8Array.from(raw);
	if (!publicKeyOf(secret.subarray(0, 32)).equals(secret.subarray(32))) {
		throw badFile("the public key does not match the secret key");
	}
	return secret;
};

const fromBase58 = (text) => {
	let value = 0n;
	for (const char of text) {
		value = value * 58n + BigInt(ALPHABET.indexOf(char));
	}
	const hex = value === 0n ? "" : value.toString(16);
	const body = Buffer.from(hex.length % 2 === 1 ? `0${hex}` : hex, "hex");
	const zeros = text.length - text.replace(/^1+/, "").length;
	return Buffer.concat([Buffer.alloc(zeros), body]);
};

const isAddress = (text) =>
	typeof text === "string" &&
	/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text) &&
	fromBase58(text).length === 32;

const readConfig = () => {
	const raw = readJson(CONFIG_FILE);
	const fields = ["source", "destination", "mint"];
	if (typeof raw !== "object" || raw === null) {
		throw badFile("the config is not an object");
	}
	const wrong = fields.find((field) => !isAddress(raw[field]));
	if (wrong !== undefined) {
		throw badFile(`${wrong} is not a Solana address`);
	}
	return { source: raw.source, destination: raw.destination, mint: raw.mint };
};

const decodeMessage = (encoded) => {
	const message = Buffer.from(encoded ?? "", "base64");
	if (message.length === 0 || message.toString("base64") !== encoded) {
		throw malformed("not canonical base64");
	}
	if (message.length > MAX_MESSAGE_BYTES) {
		throw malformed(`longer than ${MAX_MESSAGE_BYTES} bytes`);
	}
	return message;
};

const main = (encoded) => {
	const secret = readKey();
	const agent = base58(secret.subarray(32, 64));
	const config = readConfig();
	const message = decodeMessage(encoded);
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
