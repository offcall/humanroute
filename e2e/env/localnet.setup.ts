// Global setup of the e2e project (ADR 0038): local validator under the devnet CAIP-2 id with a
// loopback RPC, an own 6-decimal mint, the SDK facilitator on loopback, then the real gateway and
// MCP processes. No internet, no money. Everything is torn down on end, SIGINT and SIGTERM.
import {
	chmodSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Connection, type Keypair } from "@solana/web3.js";
import type { TestProject } from "vitest/node";
import { startFacilitator, startGateway, startMcp } from "./apps.js";
import { setupChain } from "./chain.js";
import { createCleanup } from "./cleanup.js";
import { installEgressGuard } from "./egress.js";
import { E2eMode } from "./types.js";
import { startValidator } from "./validator.js";

export const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const CLAIM_WINDOW_SECONDS = Number(process.env.E2E_CLAIM_WINDOW ?? "30");
const WORK_WINDOW_SECONDS = Number(process.env.E2E_WORK_WINDOW ?? "45");

// Keys made for this run only, mode 600 as the gateway requires.
const writeKey = (dir: string, name: string, key: Keypair): string => {
	const path = join(dir, `${name}.json`);
	writeFileSync(path, JSON.stringify([...key.secretKey]), { mode: 0o600 });
	chmodSync(path, 0o600);
	return path;
};

export default async (
	project: Pick<TestProject, "provide">,
): Promise<() => Promise<void>> => {
	const cleanup = createCleanup();
	const workDir = mkdtempSync(join(tmpdir(), "hr-e2e-"));
	cleanup.add(() => {
		if (process.env.E2E_KEEP_LOGS === "1") {
			console.log(`e2e logs kept in ${workDir}`);
			return;
		}
		rmSync(workDir, { recursive: true, force: true });
	});
	const egressLog = join(workDir, "egress.log");
	writeFileSync(egressLog, "");
	process.env.E2E_EGRESS_LOG = egressLog;
	installEgressGuard();
	try {
		const validator = await startValidator(workDir);
		cleanup.add(validator.stop);
		const connection = new Connection(validator.rpcUrl, "confirmed");
		const chain = await setupChain(connection);

		const facilitator = await startFacilitator(
			writeKey(workDir, "facilitator", chain.facilitator),
			validator.rpcUrl,
			SOLANA_DEVNET,
			workDir,
		);
		cleanup.add(facilitator.stop);

		const holdPath = writeKey(workDir, "hold", chain.hold);
		const gatewayEnv = {
			SOLANA_NETWORK: SOLANA_DEVNET,
			FACILITATOR_URL: facilitator.url,
			USDC_MINT: chain.mint.toBase58(),
			HOLD_KEYPAIR_PATH: holdPath,
			FEE_WALLET: chain.fee.publicKey.toBase58(),
			TIMER_MODE: "video",
			CLAIM_WINDOW_SECONDS: String(CLAIM_WINDOW_SECONDS),
			WORK_WINDOW_SECONDS: String(WORK_WINDOW_SECONDS),
			WEB_DIST_DIR: process.env.E2E_WEB_DIST ?? "web/dist",
		};
		const gateway = await startGateway(
			{
				...gatewayEnv,
				RPC_URL: validator.rpcUrl,
				DB_PATH: join(workDir, "gateway.db"),
			},
			workDir,
		);
		cleanup.add(gateway.stop);
		const mcp = await startMcp(gateway.url, workDir);
		cleanup.add(mcp.stop);

		project.provide("e2e", {
			mode: E2eMode.Localnet,
			gatewayUrl: gateway.url,
			mcpUrl: mcp.url,
			rpcUrl: validator.rpcUrl,
			network: SOLANA_DEVNET,
			mint: chain.mint.toBase58(),
			holdAddress: chain.hold.publicKey.toBase58(),
			feeWallet: chain.fee.publicKey.toBase58(),
			feePayer: chain.facilitator.publicKey.toBase58(),
			firms: chain.firms.map((firm) => [...firm.secretKey]),
			claimWindowSeconds: CLAIM_WINDOW_SECONDS,
			workWindowSeconds: WORK_WINDOW_SECONDS,
			logDir: workDir,
			egressLog,
			gatewayEnv,
		});
	} catch (error) {
		await cleanup.run();
		throw error;
	}
	// Any refused non-loopback attempt of any process fails the whole run (ADR 0038).
	return async () => {
		const refused = readFileSync(egressLog, "utf8");
		await cleanup.run();
		if (refused !== "") {
			throw new Error(`e2e egress attempts (blocked):\n${refused}`);
		}
	};
};
