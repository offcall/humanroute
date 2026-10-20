// Operator access to failed transfers for `npm run requeue`. Opens its own connection; the worker sends.
import { row } from "./columns.js";
import { openDb } from "./connection.js";
import { migrate } from "./migrate.js";
import { TRANSFERS_SQL } from "./sql.js";
import { toTransfer } from "./transferRow.js";
import type { RequeueStore } from "./types.js";

export const openRequeueStore = (
	path: string,
	now: () => number,
): RequeueStore => {
	const database = openDb(path);
	const migrated = migrate(database, now);
	const stmts = {
		find: database.prepare(TRANSFERS_SQL.find),
		requeue: database.prepare(TRANSFERS_SQL.requeue),
	};

	return {
		migrated,
		find: (idOrJobId) => {
			const found = row(stmts.find.get(idOrJobId, idOrJobId));
			return found ? toTransfer(found) : undefined;
		},
		requeue: (transferId, now) =>
			stmts.requeue.run(now, transferId).changes === 1,
		close: () => database.close(),
	};
};
