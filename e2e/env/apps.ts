// The real gateway (src/index.ts), the MCP server (mcp/index.ts) and the local facilitator as
// child processes through tsx.
import { join } from "node:path";
import {
	freePort,
	type Running,
	startProcess,
	stopProcess,
	waitUntil,
} from "./process.js";

const ROOT = join(import.meta.dirname, "../..");
const READY_MS = 60_000;

// Localnet only: E2E_EGRESS_LOG is set by the localnet setup, never by the devnet one.
const guard = (): string[] =>
	process.env.E2E_EGRESS_LOG ? ["--import", "./e2e/env/egressPreload.ts"] : [];

export type App = { url: string; running: Running; stop: () => Promise<void> };

const tsx = (
	name: string,
	entry: string,
	env: Record<string, string>,
	logDir: string,
): Running =>
	startProcess({
		name,
		command: process.execPath,
		args: ["--import", "tsx", ...guard(), entry],
		env: {
			PATH: process.env.PATH ?? "",
			HOME: process.env.HOME ?? "",
			E2E_EGRESS_LOG: process.env.E2E_EGRESS_LOG ?? "",
			...env,
		},
		cwd: ROOT,
		logDir,
	});

const gatewayReady = async (url: string): Promise<boolean> => {
	const res = await fetch(`${url}/health`);
	const body: unknown = await res.json();
	return (
		typeof body === "object" &&
		body !== null &&
		Reflect.get(body, "ready") === true
	);
};

// env: every gateway variable except PORT, PUBLIC_BASE_URL and MCP_PUBLIC_URL, set here.
export const startGateway = async (
	env: Record<string, string>,
	logDir: string,
	port?: number,
	name = "gateway",
): Promise<App> => {
	const chosen = port ?? (await freePort());
	const url = `http://127.0.0.1:${chosen}`;
	const running = tsx(
		name,
		"src/index.ts",
		{
			...env,
			PORT: String(chosen),
			PUBLIC_BASE_URL: url,
			MCP_PUBLIC_URL: `${url}/mcp`,
		},
		logDir,
	);
	const stop = () => stopProcess(running);
	try {
		await waitUntil(running, () => gatewayReady(url), READY_MS);
	} catch (error) {
		await stop();
		throw error;
	}
	return { url, running, stop };
};

export const startMcp = async (
	gatewayUrl: string,
	logDir: string,
): Promise<App> => {
	const port = await freePort();
	const url = `http://127.0.0.1:${port}/mcp`;
	const running = tsx(
		"mcp",
		"mcp/index.ts",
		{ GATEWAY_URL: gatewayUrl, MCP_PORT: String(port) },
		logDir,
	);
	const stop = () => stopProcess(running);
	// GET /mcp answers 405 once the server listens.
	const ready = async () => (await fetch(url)).status === 405;
	try {
		await waitUntil(running, ready, READY_MS);
	} catch (error) {
		await stop();
		throw error;
	}
	return { url, running, stop };
};

// The local facilitator (facilitatorMain.ts) as its own process, so its kit shim stays there.
export const startFacilitator = async (
	keyPath: string,
	rpcUrl: string,
	network: string,
	logDir: string,
): Promise<App> => {
	const port = await freePort();
	const url = `http://127.0.0.1:${port}`;
	const running = tsx(
		"facilitator",
		"e2e/env/facilitatorMain.ts",
		{
			FACILITATOR_KEY_PATH: keyPath,
			RPC_URL: rpcUrl,
			SOLANA_NETWORK: network,
			PORT: String(port),
		},
		logDir,
	);
	const stop = () => stopProcess(running);
	const ready = async () => (await fetch(`${url}/supported`)).ok;
	try {
		await waitUntil(running, ready, READY_MS);
	} catch (error) {
		await stop();
		throw error;
	}
	return { url, running, stop };
};
