// Global setup of the e2e-devnet project (ADR 0038): the same suites against devnet and
// x402.org. Manual only (`npm run test:e2e:devnet`), and only with the owner's permission for
// each run: it moves devnet USDC and SOL. Like scripts/e2e-devnet.sh it starts the real gateway
// (hold key HOLD_KEYPAIR_PATH, default keys/hold.json) and MCP on free ports with a fresh DB, and
// funds fresh firm wallets from the agent wallet (AGENT_KEYPAIR_PATH, default keys/agent.json).
// FEE_WALLET is required (npx tsx scripts/fee-pubkey.ts prints it). No egress guard here.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Connection } from "@solana/web3.js";
import type { TestProject } from "vitest/node";
import { readKeypair } from "../../src/config/index.js";
import { startGateway, startMcp } from "./apps.js";
import { createCleanup } from "./cleanup.js";
import { fundFirms } from "./devnetFunds.js";
import { E2eMode } from "./types.js";

const DEFAULTS = {
	RPC_URL: "https://api.devnet.solana.com",
	FACILITATOR_URL: "https://x402.org/facilitator",
	USDC_MINT: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
};
const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const FACILITATOR_FEE_PAYER_UNKNOWN = "";

const value = (name: keyof typeof DEFAULTS): string =>
	process.env[name] || DEFAULTS[name];

const keyAt = (name: string, fallback: string) => {
	const path = process.env[name] || fallback;
	const parsed = readKeypair(path);
	if (!parsed.ok) {
		throw new Error(`${name}: ${parsed.error} (run npm run setup:wallets)`);
	}
	return { path, key: parsed.value };
};

export default async (
	project: Pick<TestProject, "provide">,
): Promise<() => Promise<void>> => {
	const feeWallet = process.env.FEE_WALLET;
	if (!feeWallet) {
		throw new Error("FEE_WALLET is required: npx tsx scripts/fee-pubkey.ts");
	}
	delete process.env.E2E_EGRESS_LOG;
	const hold = keyAt("HOLD_KEYPAIR_PATH", "keys/hold.json");
	const agent = keyAt("AGENT_KEYPAIR_PATH", "keys/agent.json");
	const rpcUrl = value("RPC_URL");
	const mint = value("USDC_MINT");
	const claimWindowSeconds = Number(process.env.E2E_CLAIM_WINDOW ?? "60");
	const workWindowSeconds = Number(process.env.E2E_WORK_WINDOW ?? "90");

	const cleanup = createCleanup();
	const workDir = mkdtempSync(join(tmpdir(), "hr-e2e-devnet-"));
	cleanup.add(() => rmSync(workDir, { recursive: true, force: true }));
	try {
		const connection = new Connection(rpcUrl, "confirmed");
		const firms = await fundFirms(connection, agent.key, mint);
		const gateway = await startGateway(
			{
				RPC_URL: rpcUrl,
				SOLANA_NETWORK: SOLANA_DEVNET,
				FACILITATOR_URL: value("FACILITATOR_URL"),
				USDC_MINT: mint,
				HOLD_KEYPAIR_PATH: hold.path,
				DB_PATH: join(workDir, "gateway.db"),
				FEE_WALLET: feeWallet,
				TIMER_MODE: "video",
				CLAIM_WINDOW_SECONDS: String(claimWindowSeconds),
				WORK_WINDOW_SECONDS: String(workWindowSeconds),
				WEB_DIST_DIR: process.env.E2E_WEB_DIST ?? "web/dist",
			},
			workDir,
		);
		cleanup.add(gateway.stop);
		const mcp = await startMcp(gateway.url, workDir);
		cleanup.add(mcp.stop);

		project.provide("e2e", {
			mode: E2eMode.Devnet,
			gatewayUrl: gateway.url,
			mcpUrl: mcp.url,
			rpcUrl,
			network: SOLANA_DEVNET,
			mint,
			holdAddress: hold.key.publicKey.toBase58(),
			feeWallet,
			feePayer: FACILITATOR_FEE_PAYER_UNKNOWN,
			firms: firms.map((firm) => [...firm.secretKey]),
			claimWindowSeconds,
			workWindowSeconds,
			logDir: workDir,
			egressLog: null,
			gatewayEnv: null,
		});
	} catch (error) {
		await cleanup.run();
		throw error;
	}
	return cleanup.run;
};
