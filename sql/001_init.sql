-- Initial schema. Job state is the decision; transfer status is on-chain progress (ADR 0003).
-- Timestamps are Unix milliseconds. Money is TEXT holding a bigint in base units.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('paid', 'answered', 'released', 'refunded')),
  pay_tx TEXT NOT NULL UNIQUE,
  payer TEXT NOT NULL,
  text TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  draft TEXT,
  answer TEXT,
  viewed_at INTEGER,
  deadline_at INTEGER NOT NULL,
  refund_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX jobs_state_deadline ON jobs (state, deadline_at);

CREATE TABLE transfers (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE REFERENCES jobs (id),
  kind TEXT NOT NULL CHECK (kind IN ('release', 'refund')),
  to_wallet TEXT NOT NULL,
  amount TEXT NOT NULL,
  memo TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'confirmed', 'failed')),
  tx_sig TEXT,
  blockhash TEXT,
  last_valid_block_height INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX transfers_status ON transfers (status);

CREATE TABLE payments (
  payment_id TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL,
  job_id TEXT NOT NULL REFERENCES jobs (id),
  created_at INTEGER NOT NULL
);
