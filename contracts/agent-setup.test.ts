// Setup.mjs (ADR 0036) as a real child with a temp HOME: one key, a pinned config, no secret printed.
import { readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { Keypair } from "@solana/web3.js";
import { describe, expect, test } from "vitest";
import { runScript, SIGNER_CONFIG, tempHome } from "./agent-signer.js";

const ARGS = [
	...["--source", SIGNER_CONFIG.source, "--dest", SIGNER_CONFIG.destination],
	...[
		"--mint",
		SIGNER_CONFIG.mint,
		"--cabinet",
		"http://humanroute.test/firm/jobs",
	],
];

const modeOf = (path: string) => statSync(path).mode & 0o777;

describe("agent key setup", () => {
	test("setup.mjs creates the agent key once and writes the pinned config", () => {
		const home = tempHome();
		const dir = join(home, ".humanroute");
		const keyFile = join(dir, "agent-key.json");
		const configFile = join(dir, "config.json");
		try {
			const first = runScript(home, "setup.mjs", ARGS);
			expect(first.status).toBe(0);
			expect(modeOf(dir)).toBe(0o700);
			expect(modeOf(keyFile)).toBe(0o600);
			expect(modeOf(configFile)).toBe(0o600);

			const keyText = readFileSync(keyFile, "utf8");
			const secret: unknown = JSON.parse(keyText);
			if (
				!Array.isArray(secret) ||
				!secret.every((item) => typeof item === "number")
			) {
				throw new Error("the key file is not a list of numbers");
			}
			expect(secret).toHaveLength(64);
			const agent = Keypair.fromSecretKey(
				Uint8Array.from(secret),
			).publicKey.toBase58();
			expect(first.stdout).toContain(`Agent public key: ${agent}`);
			expect(first.stdout).toContain(
				`http://humanroute.test/firm/jobs?agent=${agent}`,
			);
			const config: unknown = JSON.parse(readFileSync(configFile, "utf8"));
			expect(config).toEqual(SIGNER_CONFIG);

			const second = runScript(home, "setup.mjs", ARGS);
			expect(second.status).toBe(0);
			expect(second.stdout).toContain("Keeping the existing agent key");
			expect(second.stdout).toContain(`Agent public key: ${agent}`);
			expect(readFileSync(keyFile, "utf8")).toBe(keyText);

			const seed = Buffer.from(Uint8Array.from(secret.slice(0, 32)));
			for (const output of [
				first.stdout,
				first.stderr,
				second.stdout,
				second.stderr,
			]) {
				expect(output).not.toContain(keyText);
				expect(output).not.toContain(secret.slice(0, 32).join(","));
				expect(output).not.toContain(seed.toString("base64"));
				expect(output).not.toContain(seed.toString("hex"));
			}
			expect(first.stdout).toContain(keyFile);
		} finally {
			rmSync(home, { recursive: true, force: true });
		}
	});
});
