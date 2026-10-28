// tasks table (ADR 0023). Every state change is a guarded UPDATE against the state and deadlines.
export const TASKS_SCHEMA_SQL = [
	`CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  firm_id TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  text TEXT NOT NULL,
  draft TEXT NOT NULL,
  result TEXT,
  reason TEXT,
  state TEXT NOT NULL CHECK (state IN ('open', 'claimed', 'submitted', 'approved', 'rejected', 'expired_unclaimed', 'expired_late')),
  price_units TEXT NOT NULL,
  refund_wallet TEXT NOT NULL,
  linguist_id TEXT,
  linguist_wallet TEXT,
  agency_id TEXT,
  agency_wallet TEXT,
  claim_deadline INTEGER NOT NULL,
  work_deadline INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`,
	"CREATE INDEX tasks_state_claim ON tasks (state, claim_deadline)",
	"CREATE INDEX tasks_order ON tasks (order_id)",
	"CREATE INDEX tasks_linguist ON tasks (linguist_id)",
	"CREATE INDEX tasks_agency ON tasks (agency_id)",
	"CREATE INDEX tasks_firm ON tasks (firm_id)",
];

export const TASKS_SQL = {
	insert: `INSERT INTO tasks (id, order_id, firm_id, source_lang, target_lang, text, draft, state,
       price_units, refund_wallet, claim_deadline, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
	byId: "SELECT * FROM tasks WHERE id = ?",
	byOrder: "SELECT * FROM tasks WHERE order_id = ? ORDER BY target_lang",
	board:
		"SELECT * FROM tasks WHERE state = 'open' AND claim_deadline > ? ORDER BY claim_deadline",
	byLinguist:
		"SELECT * FROM tasks WHERE linguist_id = ? ORDER BY created_at DESC",
	idsByAgency: "SELECT id FROM tasks WHERE agency_id = ?",
	idsByFirm: "SELECT id FROM tasks WHERE firm_id = ?",
	expiredUnclaimed:
		"SELECT * FROM tasks WHERE state = 'open' AND claim_deadline <= ?",
	expiredLate:
		"SELECT * FROM tasks WHERE state = 'claimed' AND work_deadline <= ?",
	claim: `UPDATE tasks SET state = 'claimed', linguist_id = ?, linguist_wallet = ?, agency_id = ?,
       agency_wallet = ?, work_deadline = ?, updated_at = ?
       WHERE id = ? AND state = 'open' AND claim_deadline > ?`,
	submit: `UPDATE tasks SET state = 'submitted', result = ?, updated_at = ?
       WHERE id = ? AND state = 'claimed' AND linguist_id = ? AND work_deadline > ?`,
	approve: `UPDATE tasks SET state = 'approved', updated_at = ?
       WHERE id = ? AND state = 'submitted'`,
	reject: `UPDATE tasks SET state = 'rejected', reason = ?, updated_at = ?
       WHERE id = ? AND state = 'submitted'`,
	unclaimed: `UPDATE tasks SET state = 'expired_unclaimed', updated_at = ?
       WHERE id = ? AND state = 'open' AND claim_deadline <= ?`,
	late: `UPDATE tasks SET state = 'expired_late', updated_at = ?
       WHERE id = ? AND state = 'claimed' AND work_deadline <= ?`,
	outcomesByAgency: `SELECT state, COUNT(*) AS total FROM tasks
       WHERE agency_id = ? AND state IN ('approved', 'rejected', 'expired_late') GROUP BY state`,
	outcomesByFirm: `SELECT state, COUNT(*) AS total FROM tasks
       WHERE firm_id = ? AND state IN ('approved', 'rejected', 'expired_late') GROUP BY state`,
};
