// Loads a Solana CLI keypair file (JSON array of 64 bytes) into a @solana/kit signer.
import { readFile } from "node:fs/promises";
import { createKeyPairSignerFromBytes, type KeyPairSigner } from "@solana/kit";

const SECRET_KEY_LENGTH = 64;

const isByte = (value: unknown): value is number =>
	typeof value === "number" &&
	Number.isInteger(value) &&
	value >= 0 &&
	value <= 255;

export const parseSecretKey = (raw: unknown): Uint8Array | Error => {
	if (!Array.isArray(raw) || raw.length !== SECRET_KEY_LENGTH) {
		return new Error(
			`keypair must be a JSON array of ${SECRET_KEY_LENGTH} bytes`,
		);
	}
	const bytes = new Uint8Array(SECRET_KEY_LENGTH);
	for (const [index, byte] of raw.entries()) {
		if (!isByte(byte)) {
			return new Error(`keypair byte ${index} is not in 0..255`);
		}
		bytes[index] = byte;
	}
	return bytes;
};

export const loadSigner = async (path: string): Promise<KeyPairSigner> => {
	const raw: unknown = JSON.parse(await readFile(path, "utf8"));
	const bytes = parseSecretKey(raw);
	if (bytes instanceof Error) {
		throw new Error(`${path}: ${bytes.message}`);
	}
	return createKeyPairSignerFromBytes(bytes);
};
