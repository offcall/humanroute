// orphan_payments table: money settled into hold but no job was recorded (ADR 0004).
import { int, row } from "./columns.js";
import { ORPHANS_SQL } from "./sql.js";
import type { Database, NewOrphan, OrphansRepo } from "./types.js";

export const orphansRepo = (database: Database): OrphansRepo => {
	const insert = database.prepare(ORPHANS_SQL.insert);
	const unresolved = database.prepare(ORPHANS_SQL.unresolved);

	return {
		insert: (orphan: NewOrphan): void => {
			insert.run(
				orphan.payTx,
				orphan.payer,
				orphan.network,
				orphan.rawHeader,
				orphan.reason,
				orphan.now,
			);
		},
		countUnresolved: (): number => {
			const found = row(unresolved.get());
			if (!found) {
				throw new Error("orphan count returned no row");
			}
			return int(found, "total");
		},
	};
};
