// Entry point: config -> store + slice migrations -> preflight watch -> task payout worker -> HTTP. One process (ADR 0007).
// Invalid config exits 1; a failing preflight keeps the server up and answers 503 (ADR 0008).
import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { createSolanaClient } from "./chain/index.js";
import { parseConfig, readKeypair } from "./config/index.js";
import { createApp } from "./http/index.js";
import { countUnresolvedOrphans, createFacilitator } from "./orders/index.js";
import { createTaskWorker } from "./payouts/index.js";
import { startPreflight } from "./preflight.js";
import { exit, log } from "./startup.js";
import { openStore } from "./store/index.js";
import { SLICES, wire } from "./wiring/index.js";

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
	const { database, migrated } = openStore(config.dbPath, now, SLICES);
	for (const file of migrated) {
		log("store")(`applied migration ${file}`);
	}
	const chain = createSolanaClient({
		rpcUrl: config.rpcUrl,
		mint: config.usdcMint,
		commitment: config.commitment,
		hold: hold.value,
	});
	const facilitator = createFacilitator(config.facilitatorUrl);
	const watch = await startPreflight(config, chain, facilitator);
	const orphans = countUnresolvedOrphans(database);
	if (orphans > 0) {
		log("store")(`${orphans} unresolved orphan payments need operator refund`);
	}

	const { app, payouts } = wire({
		config,
		database,
		chain,
		facilitator,
		preflightProblems: watch.problems,
		now,
		newId: randomUUID,
		log,
	});
	const worker = createTaskWorker(payouts);
	await worker.start();

	const server = serve({ fetch: createApp(app).fetch, port: config.port });
	log("http")(
		`listening on :${config.port}, payTo ${chain.holdAddress}, timers ${config.timerMode} (claim ${config.claimWindowSeconds}s, work ${config.workWindowSeconds}s)`,
	);

	const shutdown = () => {
		watch.stop();
		worker.stop();
		server.close(() => {
			database.close();
			process.exit(0);
		});
	};
	process.once("SIGINT", shutdown);
	process.once("SIGTERM", shutdown);
};

main().catch((err: unknown) =>
	exit("startup failed", [err instanceof Error ? err.message : String(err)]),
);
