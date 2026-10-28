// Migration bookkeeping. Versions are recorded as "<slice>:<version>" (see slices.ts).

export const MIGRATIONS_SQL = {
	tables:
		"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
	create:
		"CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
	applied: "SELECT version FROM schema_migrations",
	record: "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
};
