// Reads a Solana keypair file (JSON array of 64 bytes). Never logs or returns the secret in errors.
import { readFileSync, statSync } from "node:fs";
import { Keypair } from "@solana/web3.js";
import type { Parsed } from "./types.js";

const parseSecret = (raw: unknown): Uint8Array | null => {
	if (!Array.isArray(raw) || raw.length !== 64) {
		return null;
	}
	const bytes = new Uint8Array(64);
	for (const [index, value] of raw.entries()) {
		if (
			typeof value !== "number" ||
			!Number.isInteger(value) ||
			value < 0 ||
			value > 255
		) {
			return null;
		}
		bytes[index] = value;
	}
	return bytes;
};

export const readKeypair = (path: string): Parsed<Keypair> => {
	let text: string;
	try {
		const mode = statSync(path).mode;
		if (process.platform !== "win32" && (mode & 0o077) !== 0) {
			return {
				ok: false,
				error: `${path} must not be readable by group or others (chmod 600)`,
			};
		}
		text = readFileSync(path, "utf8");
	} catch {
		return { ok: false, error: `cannot read keypair file ${path}` };
	}
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, error: `${path} is not valid JSON` };
	}
	const secret = parseSecret(raw);
	if (!secret) {
		return { ok: false, error: `${path} must be a JSON array of 64 bytes` };
	}
	try {
		return { ok: true, value: Keypair.fromSecretKey(secret) };
	} catch {
		return { ok: false, error: `${path} is not a valid ed25519 keypair` };
	}
};
