// drafts, orders, payments and orphans (ADR 0022). Amounts are TEXT base units.
export const ORDERS_SCHEMA_SQL = [
	`CREATE TABLE drafts (
  id TEXT PRIMARY KEY,
  firm_id TEXT NOT NULL,
  text TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  targets_json TEXT NOT NULL,
  meta_json TEXT,
  price_units TEXT NOT NULL,
  total_units TEXT NOT NULL,
  task_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  order_id TEXT UNIQUE
)`,
	`CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL UNIQUE,
  firm_id TEXT NOT NULL,
  pay_tx TEXT NOT NULL UNIQUE,
  payer TEXT NOT NULL,
  total_units TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`,
	"CREATE INDEX orders_firm ON orders (firm_id, created_at)",
	`CREATE TABLE payments (
  payment_id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`,
	`CREATE TABLE orphans (
  id INTEGER PRIMARY KEY,
  pay_tx TEXT UNIQUE,
  payer TEXT,
  network TEXT,
  raw_header TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unparsable_settle', 'wrong_network', 'invalid_payer', 'record_failed')),
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
)`,
	"CREATE INDEX orphans_unresolved ON orphans (resolved_at)",
];

export const ORDERS_SQL = {
	insertDraft: `INSERT INTO drafts (id, firm_id, text, source_lang, targets_json, meta_json,
       price_units, total_units, task_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	draftById: "SELECT * FROM drafts WHERE id = ?",
	markPaid: "UPDATE drafts SET order_id = ? WHERE id = ? AND order_id IS NULL",
	insertOrder: `INSERT INTO orders (id, draft_id, firm_id, pay_tx, payer, total_units, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
	orderById: "SELECT * FROM orders WHERE id = ?",
	ordersByFirm:
		"SELECT * FROM orders WHERE firm_id = ? ORDER BY created_at DESC",
	insertPayment:
		"INSERT INTO payments (payment_id, draft_id, order_id, created_at) VALUES (?, ?, ?, ?)",
	paymentById: "SELECT * FROM payments WHERE payment_id = ?",
	insertOrphan:
		"INSERT OR IGNORE INTO orphans (pay_tx, payer, network, raw_header, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)",
	unresolvedOrphans:
		"SELECT COUNT(*) AS total FROM orphans WHERE resolved_at IS NULL",
};
