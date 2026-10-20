// Forward-only migrations: sql/NNN_name.sql applied in order, each in its own transaction (ADR 0007).
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MIGRATIONS_SQL } from "./sql.js";
import type { Database } from "./types.js";

const SQL_DIR = fileURLToPath(new URL("../../sql/", import.meta.url));

const tableNames = (database: Database): string[] =>
	database
		.prepare(MIGRATIONS_SQL.tables)
		.pluck()
		.all()
		.filter((name) => typeof name === "string");

// A database created before migrations existed has tables but no schema_migrations.
const assertNotLegacy = (database: Database): void => {
	const names = tableNames(database);
	if (names.length > 0 && !names.includes("schema_migrations")) {
		throw new Error(
			`legacy database at ${database.name}: delete it or set DB_PATH`,
		);
	}
};

export const migrate = (
	database: Database,
	now: () => number,
	dir: string = SQL_DIR,
): string[] => {
	assertNotLegacy(database);
	database.exec(MIGRATIONS_SQL.create);
	const applied = new Set(
		database
			.prepare(MIGRATIONS_SQL.applied)
			.pluck()
			.all()
			.filter((version) => typeof version === "string"),
	);
	const files = readdirSync(dir)
		.filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/.test(file))
		.sort();
	const done: string[] = [];
	for (const file of files) {
		const version = file.slice(0, 3);
		if (applied.has(version)) {
			continue;
		}
		const script = readFileSync(`${dir}/${file}`, "utf8");
		database.transaction(() => {
			database.exec(script);
			database.prepare(MIGRATIONS_SQL.record).run(version, now());
		})();
		done.push(file);
	}
	return done;
};
