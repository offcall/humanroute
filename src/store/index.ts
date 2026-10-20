// SQLite store: open, migrate, expose typed repositories.
import { openDb } from "./connection.js";
import { jobsRepo } from "./jobs.js";
import { migrate } from "./migrate.js";
import { orphansRepo } from "./orphans.js";
import { paymentsRepo } from "./payments.js";
import { transfersRepo } from "./transfers.js";
import type { Store } from "./types.js";

export { openRequeueStore } from "./transfersRequeue.js";

export type {
	Job,
	NewJob,
	NewOrphan,
	NewTransfer,
	Payment,
	RequeueStore,
	SentInfo,
	Store,
	Transfer,
} from "./types.js";
export {
	JobState,
	OrphanReason,
	TransferKind,
	TransferStatus,
} from "./types.js";

export const openStore = (
	path: string,
	now: () => number,
): { store: Store; migrated: string[] } => {
	const database = openDb(path);
	const migrated = migrate(database, now);
	const store: Store = {
		jobs: jobsRepo(database),
		transfers: transfersRepo(database),
		payments: paymentsRepo(database),
		orphans: orphansRepo(database),
		transaction: (work) => database.transaction(work)(),
		close: () => database.close(),
	};
	return { store, migrated };
};
