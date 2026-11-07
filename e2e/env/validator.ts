// solana-test-validator on loopback ports with a ledger in a fresh temp dir (removed on stop).
// Binary: SOLANA_TEST_VALIDATOR, else the agave-install active release, else PATH.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
	freePort,
	type Running,
	startProcess,
	stopProcess,
	waitUntil,
} from "./process.js";

const READY_MS = 60_000;
// Shreds kept in root slots: small, a run lasts minutes.
const LEDGER_SHREDS = "10000000";

export type Validator = { rpcUrl: string; stop: () => Promise<void> };

const binary = (): string => {
	const fromEnv = process.env.SOLANA_TEST_VALIDATOR;
	if (fromEnv) {
		return fromEnv;
	}
	const active = join(
		homedir(),
		".local/share/solana/install/active_release/bin/solana-test-validator",
	);
	return existsSync(active) ? active : "solana-test-validator";
};

const healthy = async (rpcUrl: string): Promise<boolean> => {
	const res = await fetch(rpcUrl, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
		signal: AbortSignal.timeout(2_000),
	});
	const body: unknown = await res.json();
	return typeof body === "object" && body !== null && "result" in body;
};

// Consecutive ports: RPC, websocket (RPC + 1), faucet, gossip, then the dynamic range.
const ports = async (): Promise<number[]> => {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const base = await freePort();
		if (base > 1024 && base < 60_000) {
			return [base, base + 2, base + 3];
		}
	}
	throw new Error("no free port range for the validator");
};

export const startValidator = async (logDir: string): Promise<Validator> => {
	const ledger = mkdtempSync(join(tmpdir(), "hr-ledger-"));
	const [rpcPort = 0, faucetPort = 0, gossipPort = 0] = await ports();
	const rangeStart = gossipPort + 1;
	let running: Running | undefined;
	const stop = async (): Promise<void> => {
		if (running) {
			await stopProcess(running);
		}
		rmSync(ledger, { recursive: true, force: true });
	};
	try {
		running = startProcess({
			name: "validator",
			command: binary(),
			args: [
				["--ledger", ledger],
				["--rpc-port", String(rpcPort)],
				["--faucet-port", String(faucetPort)],
				["--gossip-port", String(gossipPort)],
				["--dynamic-port-range", `${rangeStart}-${rangeStart + 30}`],
				["--bind-address", "127.0.0.1"],
				["--limit-ledger-size", LEDGER_SHREDS],
				["--quiet"],
			].flat(),
			env: { PATH: process.env.PATH ?? "", HOME: homedir() },
			cwd: ledger,
			logDir,
		});
		const rpcUrl = `http://127.0.0.1:${rpcPort}`;
		const current = running;
		await waitUntil(current, () => healthy(rpcUrl), READY_MS);
		return { rpcUrl, stop };
	} catch (error) {
		await stop();
		throw error;
	}
};
