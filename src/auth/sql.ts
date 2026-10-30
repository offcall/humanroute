// SQL for the auth slice: nonces and sessions (ADR 0020). Times are Unix milliseconds.

export const AUTH_SCHEMA_SQL: string[] = [
	"CREATE TABLE nonces (nonce TEXT PRIMARY KEY, wallet TEXT NOT NULL, message TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER)",
	"CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, wallet TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)",
];

export const NONCES_SQL = {
	insert:
		"INSERT INTO nonces (nonce, wallet, message, expires_at) VALUES (?, ?, ?, ?)",
	consume:
		"UPDATE nonces SET used_at = ? WHERE nonce = ? AND wallet = ? AND used_at IS NULL AND expires_at > ?",
	message: "SELECT message FROM nonces WHERE nonce = ?",
};

export const SESSIONS_SQL = {
	insert:
		"INSERT INTO sessions (token_hash, wallet, created_at, expires_at) VALUES (?, ?, ?, ?)",
	wallet: "SELECT wallet FROM sessions WHERE token_hash = ? AND expires_at > ?",
	delete: "DELETE FROM sessions WHERE token_hash = ?",
};
