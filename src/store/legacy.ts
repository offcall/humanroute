// v1 databases have no slice-prefixed migrations (ADR 0022). Refuse them instead of mixing schemas.
import { MIGRATIONS_SQL } from "./sql.js";
import type { Database } from "./types.js";

const strings = (values: unknown[]): string[] =>
	values.filter((value): value is string => typeof value === "string");

export const assertNotLegacy = (database: Database): void => {
	const tables = strings(database.prepare(MIGRATIONS_SQL.tables).pluck().all());
	if (tables.length === 0) {
		return;
	}
	if (!tables.includes("schema_migrations")) {
		throw new Error(
			`legacy v1 database at ${database.name}: use a fresh DB_PATH`,
		);
	}
	const applied = strings(
		database.prepare(MIGRATIONS_SQL.applied).pluck().all(),
	);
	if (applied.some((version) => !version.includes(":"))) {
		throw new Error(
			`legacy v1 database at ${database.name}: use a fresh DB_PATH`,
		);
	}
};
