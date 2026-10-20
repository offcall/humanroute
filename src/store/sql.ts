// SQL statements per table. State and status literals equal the enum values in types.ts.

export const JOBS_SQL = {
	byId: "SELECT * FROM jobs WHERE id = ?",
	byPayTx: "SELECT * FROM jobs WHERE pay_tx = ?",
	insert: `INSERT INTO jobs (id, state, pay_tx, payer, text, source_lang, target_lang, draft, deadline_at, created_at, updated_at)
       VALUES (?, 'paid', ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (pay_tx) DO NOTHING`,
	open: "SELECT * FROM jobs WHERE state = 'paid' AND deadline_at > ? ORDER BY created_at",
	expired: "SELECT * FROM jobs WHERE state = 'paid' AND deadline_at <= ?",
	byState: "SELECT * FROM jobs WHERE state = ? ORDER BY created_at",
	viewed:
		"UPDATE jobs SET viewed_at = ?, updated_at = ? WHERE id = ? AND viewed_at IS NULL",
	answer: `UPDATE jobs SET state = 'answered', answer = ?, updated_at = ?
       WHERE id = ? AND state = 'paid' AND deadline_at > ?`,
	decide:
		"UPDATE jobs SET state = ?, refund_reason = ?, updated_at = ? WHERE id = ? AND state = ?",
};

export const TRANSFERS_SQL = {
	insert: `INSERT INTO transfers (id, job_id, kind, to_wallet, amount, memo, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
	byId: "SELECT * FROM transfers WHERE id = ?",
	byJob: "SELECT * FROM transfers WHERE job_id = ?",
	byStatus: "SELECT * FROM transfers WHERE status = ? ORDER BY created_at",
	sent: `UPDATE transfers SET status = 'sent', tx_sig = ?, blockhash = ?, last_valid_block_height = ?, updated_at = ?
       WHERE id = ? AND status = 'pending'`,
	confirmed:
		"UPDATE transfers SET status = 'confirmed', tx_sig = ?, updated_at = ? WHERE id = ? AND status = 'sent'",
	failed: `UPDATE transfers SET status = 'failed', last_error = ?, updated_at = ?
       WHERE id = ? AND status IN ('pending', 'sent')`,
	pending: `UPDATE transfers SET status = 'pending', tx_sig = NULL, blockhash = NULL, last_valid_block_height = NULL,
       attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id = ? AND status IN ('pending', 'sent')`,
	find: "SELECT * FROM transfers WHERE id = ? OR job_id = ?",
	requeue: `UPDATE transfers SET status = 'pending', tx_sig = NULL, blockhash = NULL, last_valid_block_height = NULL,
       last_error = NULL, updated_at = ? WHERE id = ? AND status = 'failed'`,
};

export const PAYMENTS_SQL = {
	get: "SELECT * FROM payments WHERE payment_id = ?",
	insert:
		"INSERT INTO payments (payment_id, fingerprint, job_id, created_at) VALUES (?, ?, ?, ?)",
};

export const ORPHANS_SQL = {
	insert:
		"INSERT OR IGNORE INTO orphan_payments (pay_tx, payer, network, raw_header, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)",
	unresolved:
		"SELECT COUNT(*) AS total FROM orphan_payments WHERE resolved_at IS NULL",
};

export const MIGRATIONS_SQL = {
	tables:
		"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
	create:
		"CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
	applied: "SELECT version FROM schema_migrations",
	record: "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
};
