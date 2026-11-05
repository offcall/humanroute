// SQL for the notify slice: push_subscriptions (ADR 0029). Times are Unix milliseconds.

export const NOTIFY_SCHEMA_SQL: string[] = [
	"CREATE TABLE push_subscriptions (endpoint TEXT PRIMARY KEY, linguist_id TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at INTEGER NOT NULL)",
	"CREATE INDEX push_subscriptions_linguist ON push_subscriptions (linguist_id)",
];

export const PUSH_SQL = {
	// One device belongs to the last linguist who subscribed on it.
	upsert:
		"INSERT INTO push_subscriptions (endpoint, linguist_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (endpoint) DO UPDATE SET linguist_id = excluded.linguist_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = excluded.created_at",
	remove: "DELETE FROM push_subscriptions WHERE endpoint = ?",
	// Keeps a linguist's newest ? rows; the upsert just made the current device the newest.
	trim: "DELETE FROM push_subscriptions WHERE linguist_id = ? AND endpoint NOT IN (SELECT endpoint FROM push_subscriptions WHERE linguist_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?)",
	// ? is a JSON array of linguist ids.
	byLinguists:
		"SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE linguist_id IN (SELECT value FROM json_each(?))",
};
