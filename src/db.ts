// SQLite store. Job state (the decision) and transfer status (on-chain progress) are separate:
// jobs.state: paid -> answered -> released | paid -> refunded
// transfers.status: pending -> sent -> confirmed | failed
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';

export type JobState = 'paid' | 'answered' | 'released' | 'refunded';
export type TransferKind = 'release' | 'refund';
export type TransferStatus = 'pending' | 'sent' | 'confirmed' | 'failed';

export interface Job {
  id: string;
  state: JobState;
  pay_tx: string;
  payer: string;
  text: string;
  source_lang: string;
  target_lang: string;
  draft: string | null;
  answer: string | null;
  refund_reason: string | null;
  status_token: string;
  viewed_at: number | null;
  answered_at: number | null;
  deadline_at: number;
  created_at: number;
}

export interface Transfer {
  id: string;
  job_id: string;
  kind: TransferKind;
  to_addr: string;
  amount: number; // USDC base units (6 decimals)
  memo: string;
  status: TransferStatus;
  tx_sig: string | null;
  error: string | null;
  created_at: number;
  updated_at: number;
}

export type Db = ReturnType<typeof openDb>;

// Each entry runs once, in order; PRAGMA user_version tracks the applied count.
const MIGRATIONS: string[] = [
  `CREATE TABLE jobs (
     id TEXT PRIMARY KEY,
     state TEXT NOT NULL CHECK (state IN ('paid','answered','released','refunded')),
     pay_tx TEXT NOT NULL UNIQUE,
     payer TEXT NOT NULL,
     text TEXT NOT NULL,
     source_lang TEXT NOT NULL,
     target_lang TEXT NOT NULL,
     draft TEXT,
     answer TEXT,
     refund_reason TEXT,
     status_token TEXT NOT NULL,
     viewed_at INTEGER,
     answered_at INTEGER,
     deadline_at INTEGER NOT NULL,
     created_at INTEGER NOT NULL
   );
   CREATE INDEX jobs_state_deadline ON jobs(state, deadline_at);
   CREATE TABLE transfers (
     id TEXT PRIMARY KEY,
     job_id TEXT NOT NULL REFERENCES jobs(id),
     kind TEXT NOT NULL CHECK (kind IN ('release','refund')),
     to_addr TEXT NOT NULL,
     amount INTEGER NOT NULL,
     memo TEXT NOT NULL,
     status TEXT NOT NULL CHECK (status IN ('pending','sent','confirmed','failed')),
     tx_sig TEXT,
     error TEXT,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   );
   CREATE UNIQUE INDEX transfers_job_id ON transfers(job_id);
   CREATE INDEX transfers_status ON transfers(status);`,
];

export interface NewJob {
  payTx: string;
  payer: string;
  text: string;
  sourceLang: string;
  targetLang: string;
  slaSeconds: number;
}

export interface Payouts {
  expertWallet: string;
  releaseUnits: bigint;
  refundUnits: bigint;
}

export function openDb(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);

  const q = {
    jobById: db.prepare<[string], Job>('SELECT * FROM jobs WHERE id = ?'),
    jobByPayTx: db.prepare<[string], Job>('SELECT * FROM jobs WHERE pay_tx = ?'),
    insertJob: db.prepare(
      `INSERT INTO jobs (id, state, pay_tx, payer, text, source_lang, target_lang, status_token, deadline_at, created_at)
       VALUES (@id, 'paid', @pay_tx, @payer, @text, @source_lang, @target_lang, @status_token, @deadline_at, @created_at)
       ON CONFLICT(pay_tx) DO NOTHING`,
    ),
    jobsByState: db.prepare<[JobState], Job>('SELECT * FROM jobs WHERE state = ? ORDER BY created_at'),
    allJobs: db.prepare<[], Job>('SELECT * FROM jobs ORDER BY created_at DESC'),
    markViewed: db.prepare('UPDATE jobs SET viewed_at = ? WHERE id = ? AND viewed_at IS NULL'),
    saveDraft: db.prepare(`UPDATE jobs SET draft = ? WHERE id = ? AND state = 'paid'`),
    answer: db.prepare(
      `UPDATE jobs SET state = 'answered', answer = ?, answered_at = ?
       WHERE id = ? AND state = 'paid' AND deadline_at > ?`,
    ),
    expired: db.prepare<[number], Job>(`SELECT * FROM jobs WHERE state = 'paid' AND deadline_at <= ?`),
    answered: db.prepare<[], Job>(`SELECT * FROM jobs WHERE state = 'answered'`),
    setState: db.prepare(
      `UPDATE jobs SET state = @to, refund_reason = @reason WHERE id = @id AND state = @from`,
    ),
    insertTransfer: db.prepare(
      `INSERT INTO transfers (id, job_id, kind, to_addr, amount, memo, status, created_at, updated_at)
       VALUES (@id, @job_id, @kind, @to_addr, @amount, @memo, 'pending', @now, @now)`,
    ),
    transferById: db.prepare<[string], Transfer>('SELECT * FROM transfers WHERE id = ?'),
    transferByJob: db.prepare<[string], Transfer>('SELECT * FROM transfers WHERE job_id = ?'),
    transfersByStatus: db.prepare<[TransferStatus], Transfer>(
      'SELECT * FROM transfers WHERE status = ? ORDER BY created_at',
    ),
    markSent: db.prepare(
      `UPDATE transfers SET status = 'sent', tx_sig = ?, updated_at = ? WHERE id = ? AND status = 'pending'`,
    ),
    markConfirmed: db.prepare(
      `UPDATE transfers SET status = 'confirmed', updated_at = ? WHERE id = ? AND status = 'sent'`,
    ),
    markFailed: db.prepare(
      `UPDATE transfers SET status = 'failed', error = ?, updated_at = ? WHERE id = ? AND status IN ('pending','sent')`,
    ),
    resetPending: db.prepare(
      `UPDATE transfers SET status = 'pending', tx_sig = NULL, error = ?, updated_at = ? WHERE id = ? AND status IN ('sent','failed')`,
    ),
  };

  // Moves one job to a terminal state and creates its single transfer row atomically.
  function decide(job: Job, to: 'released' | 'refunded', reason: string | null, p: Payouts, now: number): Transfer | null {
    const changed = q.setState.run({ id: job.id, from: job.state, to, reason }).changes;
    if (changed === 0) return null;
    const id = randomUUID();
    q.insertTransfer.run({
      id,
      job_id: job.id,
      kind: to === 'released' ? 'release' : 'refund',
      to_addr: to === 'released' ? p.expertWallet : job.payer,
      amount: Number(to === 'released' ? p.releaseUnits : p.refundUnits),
      memo: `hr:${job.id}`,
      now,
    });
    return q.transferById.get(id)!;
  }

  return {
    raw: db,
    close: () => db.close(),

    getJob: (id: string) => q.jobById.get(id),
    getJobByPayTx: (payTx: string) => q.jobByPayTx.get(payTx),
    listJobs: (state?: JobState) => (state ? q.jobsByState.all(state) : q.allJobs.all()),

    // Idempotent on pay_tx: a replayed settlement returns the existing job, created=false.
    insertPaidJob(j: NewJob, now = Date.now()): { job: Job; created: boolean } {
      const id = randomUUID();
      const res = q.insertJob.run({
        id,
        pay_tx: j.payTx,
        payer: j.payer,
        text: j.text,
        source_lang: j.sourceLang,
        target_lang: j.targetLang,
        status_token: randomBytes(16).toString('hex'),
        deadline_at: now + j.slaSeconds * 1000,
        created_at: now,
      });
      return { job: q.jobByPayTx.get(j.payTx)!, created: res.changes === 1 };
    },

    markViewed: (id: string, now = Date.now()) => q.markViewed.run(now, id).changes === 1,
    saveDraft: (id: string, draft: string) => q.saveDraft.run(draft, id).changes === 1,
    // Returns false if the job is not paid or the deadline has passed (late answer rejected).
    answerJob: (id: string, answer: string, now = Date.now()) => q.answer.run(answer, now, id, now).changes === 1,

    // Worker sweep: expired paid -> refunded, answered -> released; one transaction, one transfer per job.
    sweep: db.transaction((p: Payouts, now: number = Date.now()): Transfer[] => {
      const out: Transfer[] = [];
      for (const job of q.expired.all(now)) {
        const t = decide(job, 'refunded', 'sla_expired', p, now);
        if (t) out.push(t);
      }
      for (const job of q.answered.all()) {
        const t = decide(job, 'released', null, p, now);
        if (t) out.push(t);
      }
      return out;
    }),

    getTransfer: (id: string) => q.transferById.get(id),
    getTransferByJob: (jobId: string) => q.transferByJob.get(jobId),
    listTransfers: (status: TransferStatus) => q.transfersByStatus.all(status),
    markTransferSent: (id: string, txSig: string, now = Date.now()) => q.markSent.run(txSig, now, id).changes === 1,
    markTransferConfirmed: (id: string, now = Date.now()) => q.markConfirmed.run(now, id).changes === 1,
    markTransferFailed: (id: string, error: string, now = Date.now()) => q.markFailed.run(error, now, id).changes === 1,
    // For a sent transfer whose signature is known to have dropped: allow a fresh send.
    resetTransferToPending: (id: string, note: string, now = Date.now()) =>
      q.resetPending.run(note, now, id).changes === 1,
  };
}

function migrate(db: Database.Database) {
  const version = db.pragma('user_version', { simple: true }) as number;
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i]);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
}
