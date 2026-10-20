// SQLite connection with WAL, foreign keys and a busy timeout.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import SqliteDriver from "better-sqlite3";
import type { Database } from "./types.js";

export const openDb = (path: string): Database => {
	if (path !== ":memory:") {
		mkdirSync(dirname(path), { recursive: true });
	}
	const database = new SqliteDriver(path);
	database.pragma("journal_mode = WAL");
	database.pragma("foreign_keys = ON");
	database.pragma("busy_timeout = 5000");
	return database;
};
