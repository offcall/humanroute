// Operator entry: `npm run requeue -- <transferId|taskId>`. Moves a failed transfer back to pending
// when ADR 0006 allows it. Sends nothing; the running worker sends. Exit 0 requeued, 2 refused, 1 error.
import { createSolanaClient } from "./chain/index.js";
import { parseConfig, readKeypair } from "./config/index.js";
import { requeueTransfer, taskLedger } from "./payouts/index.js";
import { openStore } from "./store/index.js";
import { SLICES } from "./wiring/index.js";

const EXIT_REFUSED = 2;

const exit = (message: string): never => {
	console.error(`requeue: ${message}`);
	process.exit(1);
};

const main = async (): Promise<number> => {
	const idOrTaskId = process.argv[2];
	if (idOrTaskId === undefined || process.argv.length > 3) {
		return exit("usage: npm run requeue -- <transferId|taskId>");
	}
	const parsed = parseConfig(process.env);
	if (!parsed.ok) {
		return exit(`invalid configuration: ${parsed.error}`);
	}
	const config = parsed.value;
	const hold = readKeypair(config.holdKeypairPath);
	if (!hold.ok) {
		return exit(`cannot load hold keypair: ${hold.error}`);
	}

	const now = () => Date.now();
	const { database, migrated } = openStore(config.dbPath, now, SLICES);
	for (const file of migrated) {
		console.log(`requeue: applied migration ${file}`);
	}
	const chain = createSolanaClient({
		rpcUrl: config.rpcUrl,
		mint: config.usdcMint,
		commitment: config.commitment,
		hold: hold.value,
	});
	const result = await requeueTransfer(
		{ store: taskLedger(database), chain, now },
		idOrTaskId,
	).finally(() => database.close());

	switch (result.outcome) {
		case "requeued":
			console.log(
				`requeue: transfer ${result.transfer.id} task ${result.transfer.taskId} is pending again (attempts ${result.transfer.attempts})`,
			);
			return 0;
		case "refused":
			console.log(`requeue: refused: ${result.reason}`);
			return EXIT_REFUSED;
		case "error":
			return exit(result.error);
	}
};

main()
	.then((code) => process.exit(code))
	.catch((err: unknown) =>
		exit(err instanceof Error ? err.message : String(err)),
	);
