// Slice migrations: each slice owns versioned SQL, recorded as "<slice>:<version>".
import { MIGRATIONS_SQL } from "./sql.js";
import type { Database } from "./types.js";

export type SliceMigration = { version: string; sql: string[] };
export type SliceDefinition = { slice: string; migrations: SliceMigration[] };

export const withTransaction = <T = unknown>(
	database: Database,
	work: () => T,
): T => database.transaction(work)();

export const migrateSlices = (
	database: Database,
	now: () => number,
	slices: SliceDefinition[],
): string[] => {
	database.exec(MIGRATIONS_SQL.create);
	const applied = new Set(
		database
			.prepare(MIGRATIONS_SQL.applied)
			.pluck()
			.all()
			.filter((version) => typeof version === "string"),
	);
	const done: string[] = [];
	for (const { slice, migrations } of slices) {
		for (const migration of migrations) {
			const key = `${slice}:${migration.version}`;
			if (applied.has(key)) {
				continue;
			}
			withTransaction(database, () => {
				for (const statement of migration.sql) {
					database.exec(statement);
				}
				database.prepare(MIGRATIONS_SQL.record).run(key, now());
			});
			done.push(key);
		}
	}
	return done;
};
