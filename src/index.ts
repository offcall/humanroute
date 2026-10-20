// Entry point: config -> store + migrations -> preflight watch -> payout worker -> HTTP. One process (ADR 0007).
// Invalid config exits 1; a failing preflight keeps the server up and answers 503 (ADR 0008).
import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { createSolanaClient, type SolanaClient } from "./chain/index.js";
import { parseConfig, readKeypair } from "./config/index.js";
import { createApp } from "./http/index.js";
import { createFacilitator } from "./payments/index.js";
import { createWorker } from "./payouts/index.js";
import { startPreflight } from "./preflight.js";
import { exit, log } from "./startup.js";
import { openStore } from "./store/index.js";

const MAX_TRANSFER_ATTEMPTS = 10;

const main = async (): Promise<void> => {
	const parsed = parseConfig(process.env);
	if (!parsed.ok) {
		exit("invalid configuration", parsed.error.split("\n"));
	}
	const config = parsed.value;
	const hold = readKeypair(config.holdKeypairPath);
	if (!hold.ok) {
		exit("cannot load hold keypair", [hold.error]);
	}

	const now = () => Date.now();
	const { store, migrated } = openStore(config.dbPath, now);
	for (const file of migrated) {
		log("store")(`applied migration ${file}`);
	}
	const chain: SolanaClient = createSolanaClient({
		rpcUrl: config.rpcUrl,
		mint: config.usdcMint,
		commitment: config.commitment,
		hold: hold.value,
	});
	const facilitator = createFacilitator(config.facilitatorUrl);
	const watch = await startPreflight(config, chain, facilitator);
	const orphans = store.orphans.countUnresolved();
	if (orphans > 0) {
		log("store")(`${orphans} unresolved orphan payments need operator refund`);
	}

	const terms = {
		expertWallet: config.expertWallet,
		releaseUnits: config.releaseUnits,
		refundUnits: config.refundUnits,
	};
	const worker = createWorker({
		store,
		chain,
		terms,
		maxAttempts: MAX_TRANSFER_ATTEMPTS,
		preflightProblems: watch.problems,
		now,
		newId: randomUUID,
		log: log("payouts"),
	});
	await worker.start();

	const app = createApp({
		store,
		config,
		facilitator,
		payTo: chain.holdAddress,
		preflightProblems: watch.problems,
		now,
		newId: randomUUID,
		log: log("payments"),
	});
	const server = serve({ fetch: app.fetch, port: config.port });
	const price = `${config.priceUnits} base units of ${config.usdcMint}`;
	log("http")(
		`listening on :${config.port}, payTo ${chain.holdAddress}, price ${price}, sla ${config.slaSeconds}s`,
	);

	const shutdown = () => {
		watch.stop();
		worker.stop();
		server.close(() => {
			store.close();
			process.exit(0);
		});
	};
	process.once("SIGINT", shutdown);
	process.once("SIGTERM", shutdown);
};

main().catch((err: unknown) =>
	exit("startup failed", [err instanceof Error ? err.message : String(err)]),
);
