// v2 transfers table: one row per task (UNIQUE task_id), legs as typed JSON (ADR 0024).
// Status literals equal TransferStatus in the store index.
export const PAYOUTS_SCHEMA_SQL = [
	`CREATE TABLE transfers (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('payout', 'refund')),
  legs TEXT NOT NULL,
  memo TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'confirmed', 'failed')),
  tx_sig TEXT,
  blockhash TEXT,
  last_valid_block_height INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`,
	"CREATE INDEX transfers_status ON transfers (status)",
];

export const PAYOUTS_SQL = {
	insert: `INSERT INTO transfers (id, task_id, kind, legs, memo, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
	byTask: "SELECT * FROM transfers WHERE task_id = ?",
	byStatus: "SELECT * FROM transfers WHERE status = ? ORDER BY created_at",
	confirmedLegs:
		"SELECT task_id, legs FROM transfers WHERE status = 'confirmed'",
	sent: `UPDATE transfers SET status = 'sent', tx_sig = ?, blockhash = ?, last_valid_block_height = ?, updated_at = ?
       WHERE id = ? AND status = 'pending'`,
	confirmed:
		"UPDATE transfers SET status = 'confirmed', tx_sig = ?, updated_at = ? WHERE id = ? AND status = 'sent'",
	failed: `UPDATE transfers SET status = 'failed', last_error = ?, updated_at = ?
       WHERE id = ? AND status IN ('pending', 'sent')`,
	pending: `UPDATE transfers SET status = 'pending', tx_sig = NULL, blockhash = NULL, last_valid_block_height = NULL,
       attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id = ? AND status IN ('pending', 'sent')`,
	find: "SELECT * FROM transfers WHERE id = ? OR task_id = ?",
	requeue: `UPDATE transfers SET status = 'pending', tx_sig = NULL, blockhash = NULL, last_valid_block_height = NULL,
       last_error = NULL, updated_at = ? WHERE id = ? AND status = 'failed'`,
};
