// Keypair files: synthetic temp files only, never keys/*.json.
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Keypair } from "@solana/web3.js";
import { afterEach, describe, expect, it } from "vitest";
import { readKeypair } from "./keypair.js";

const seeded = Keypair.fromSeed(new Uint8Array(32).fill(9));
const SECRET = Array.from(seeded.secretKey);
const dirs: string[] = [];

const keyFile = (text: string, mode = 0o600): string => {
	const dir = mkdtempSync(join(tmpdir(), "hr-keypair-"));
	dirs.push(dir);
	const path = join(dir, "key.json");
	writeFileSync(path, text);
	chmodSync(path, mode);
	return path;
};

afterEach(() => {
	for (const dir of dirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("readKeypair", () => {
	it("CF-08 refuses an unsafe or invalid key file and never echoes the secret", () => {
		const mismatched = [...SECRET.slice(0, 32), ...new Array(32).fill(1)];
		const refused: [string, string][] = [
			["group-readable", keyFile(JSON.stringify(SECRET), 0o640)],
			["other-readable", keyFile(JSON.stringify(SECRET), 0o604)],
			["absent", join(tmpdir(), "hr-keypair-absent", "none.json")],
			["not JSON", keyFile("[1, 2,")],
			["63 bytes", keyFile(JSON.stringify(SECRET.slice(0, 63)))],
			["byte 256", keyFile(JSON.stringify([...SECRET.slice(0, 63), 256]))],
			["byte -1", keyFile(JSON.stringify([...SECRET.slice(0, 63), -1]))],
			["fraction", keyFile(JSON.stringify([...SECRET.slice(0, 63), 1.5]))],
			["mismatched pair", keyFile(JSON.stringify(mismatched))],
		];
		const secretText = SECRET.slice(0, 8).join(",");

		for (const [label, path] of refused) {
			const result = readKeypair(path);
			expect(result.ok, label).toBe(false);
			if (!result.ok) {
				expect(result.error, label).toContain(path);
				expect(result.error.replace(/\s/g, ""), label).not.toContain(
					secretText,
				);
			}
		}

		const valid = readKeypair(keyFile(JSON.stringify(SECRET)));
		expect(valid.ok && valid.value.publicKey.toBase58()).toBe(
			seeded.publicKey.toBase58(),
		);
	});
});
