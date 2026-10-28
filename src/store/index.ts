// SQLite store: open the database, refuse a v1 file, run the slice migrations.
import { openDb } from "./connection.js";
import { assertNotLegacy } from "./legacy.js";
import { migrateSlices, type SliceDefinition } from "./slices.js";
import type { Database } from "./types.js";

export {
	int,
	oneOf,
	optInt,
	optText,
	row,
	rows,
	text,
	units,
} from "./columns.js";
export type { SliceDefinition, SliceMigration } from "./slices.js";
export { withTransaction } from "./slices.js";
export type { Database, Row } from "./types.js";
export { TransferStatus } from "./types.js";

export const openStore = (
	path: string,
	now: () => number,
	slices: SliceDefinition[],
): { database: Database; migrated: string[] } => {
	const database = openDb(path);
	assertNotLegacy(database);
	const migrated = migrateSlices(database, now, slices);
	return { database, migrated };
};
