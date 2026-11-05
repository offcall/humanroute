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

// Login requests (ADR 0034): a waiting tab is signed in by a wallet approve in Phantom.
export const LOGIN_REQUESTS_SCHEMA_SQL: string[] = [
	"CREATE TABLE login_requests (id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, approved_wallet TEXT, approved_at INTEGER, rejected_at INTEGER, consumed_at INTEGER)",
];

export const LOGIN_REQUESTS_SQL = {
	insert:
		"INSERT INTO login_requests (id, secret_hash, created_at, expires_at) VALUES (?, ?, ?, ?)",
	approve:
		"UPDATE login_requests SET approved_wallet = ?, approved_at = ? WHERE id = ? AND approved_at IS NULL AND rejected_at IS NULL AND expires_at > ?",
	reject:
		"UPDATE login_requests SET rejected_at = ? WHERE id = ? AND approved_at IS NULL AND rejected_at IS NULL AND expires_at > ?",
	consume:
		"UPDATE login_requests SET consumed_at = ? WHERE id = ? AND approved_at IS NOT NULL AND consumed_at IS NULL AND expires_at > ?",
	byId: "SELECT secret_hash, expires_at, approved_wallet, approved_at, rejected_at, consumed_at FROM login_requests WHERE id = ?",
};
