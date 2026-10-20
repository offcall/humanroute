-- Settled payments that have no job (ADR 0004). Refunding them is a manual operator action.
-- pay_tx and network are NULL when the settle response could not be read.

CREATE TABLE orphan_payments (
  id INTEGER PRIMARY KEY,
  pay_tx TEXT UNIQUE,
  payer TEXT,
  network TEXT,
  raw_header TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unparsable_settle', 'wrong_network', 'invalid_payer', 'record_failed')),
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX orphan_payments_unresolved ON orphan_payments (resolved_at);
