// Idempotent keypair files: Solana CLI-style JSON arrays of 64 secret-key bytes, mode 0600.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Keypair } from "@solana/web3.js";

const SECRET_KEY_LENGTH = 64;

const isByte = (value: unknown): value is number =>
	typeof value === "number" &&
	Number.isInteger(value) &&
	value >= 0 &&
	value <= 255;

const parseSecretKey = (raw: unknown, path: string): Uint8Array => {
	if (!Array.isArray(raw) || raw.length !== SECRET_KEY_LENGTH) {
		throw new Error(
			`${path}: keypair must be a JSON array of ${SECRET_KEY_LENGTH} bytes`,
		);
	}
	const bytes = new Uint8Array(SECRET_KEY_LENGTH);
	for (const [index, byte] of raw.entries()) {
		if (!isByte(byte)) {
			throw new Error(`${path}: keypair byte ${index} is not in 0..255`);
		}
		bytes[index] = byte;
	}
	return bytes;
};

export const loadOrCreateKeypair = (path: string): Keypair => {
	if (existsSync(path)) {
		const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
		return Keypair.fromSecretKey(parseSecretKey(raw, path));
	}
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	const keypair = Keypair.generate();
	writeFileSync(path, JSON.stringify(Array.from(keypair.secretKey)), {
		mode: 0o600,
	});
	console.log(`created ${path} (${keypair.publicKey.toBase58()})`);
	return keypair;
};
