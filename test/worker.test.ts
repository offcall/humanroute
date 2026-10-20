// Worker sweep + payouts with a mocked SolanaClient (no RPC).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { loadConfig } from '../src/config.js';
import { openDb, type Db } from '../src/db.js';
import type { SolanaClient, SigStatus } from '../src/solana.js';
import { createWorker } from '../src/worker.js';

const payer = Keypair.generate().publicKey.toBase58();
const expert = Keypair.generate().publicKey.toBase58();
const cfg = loadConfig({ EXPERT_WALLET: expert, DB_PATH: ':memory:' });

function mockSolana() {
  let n = 0;
  const statuses = new Map<string, SigStatus>();
  const sol = {
    statuses,
    transferToken: vi.fn(async (_to: string, _amount: bigint, _memo: string) => `txSig${++n}`),
    confirmSignature: vi.fn(async () => true),
    getSignatureStatus: vi.fn(async (sig: string) => statuses.get(sig) ?? 'unknown'),
    holdAddress: () => 'hold',
  };
  return sol;
}

describe('worker', () => {
  let db: Db;
  let sol: ReturnType<typeof mockSolana>;
  let worker: ReturnType<typeof createWorker>;
  const t0 = 1_000_000;

  const newJob = (payTx: string, now = t0) =>
    db.insertPaidJob({ payTx, payer, text: 'hi', sourceLang: 'en', targetLang: 'de', slaSeconds: cfg.slaSeconds }, now).job;

  beforeEach(() => {
    db = openDb(':memory:');
    sol = mockSolana();
    worker = createWorker(db, sol as unknown as SolanaClient, cfg, { log: () => {} });
  });
  afterEach(() => {
    worker.stop();
    db.close();
  });

  it('defaults: refund 0.50, release 0.45, sla 60 s', () => {
    expect(cfg.refundUnits).toBe(500_000n);
    expect(cfg.releaseUnits).toBe(450_000n);
    expect(cfg.slaSeconds).toBe(60);
  });

  it('leaves a paid job before its deadline alone', async () => {
    const job = newJob('pay1');
    await worker.tick(t0 + 59_000);
    expect(db.getJob(job.id)!.state).toBe('paid');
    expect(sol.transferToken).not.toHaveBeenCalled();
  });

  it('sweep refunds an expired paid job once (0.50 to payer, memo hr:<jobId>)', async () => {
    const job = newJob('pay1');
    await worker.tick(t0 + 60_000);

    const j = db.getJob(job.id)!;
    expect(j.state).toBe('refunded');
    expect(j.refund_reason).toBe('sla_expired');
    expect(sol.transferToken).toHaveBeenCalledTimes(1);
    expect(sol.transferToken).toHaveBeenCalledWith(payer, 500_000n, `hr:${job.id}`);
    const t = db.getTransferByJob(job.id)!;
    expect(t).toMatchObject({ kind: 'refund', to_addr: payer, amount: 500_000, status: 'confirmed', tx_sig: 'txSig1' });

    await worker.tick(t0 + 120_000);
    expect(sol.transferToken).toHaveBeenCalledTimes(1);
  });

  it('answered job releases 0.45 to the expert wallet', async () => {
    const job = newJob('pay1');
    expect(db.answerJob(job.id, 'Hallo', t0 + 10_000)).toBe(true);
    await worker.tick(t0 + 11_000);

    expect(db.getJob(job.id)!.state).toBe('released');
    expect(sol.transferToken).toHaveBeenCalledTimes(1);
    expect(sol.transferToken).toHaveBeenCalledWith(expert, 450_000n, `hr:${job.id}`);
    expect(db.getTransferByJob(job.id)).toMatchObject({ kind: 'release', amount: 450_000, status: 'confirmed' });
  });

  it('late answer is rejected and the job is refunded', async () => {
    const job = newJob('pay1');
    expect(db.answerJob(job.id, 'too late', t0 + 60_000)).toBe(false);
    await worker.tick(t0 + 60_000);
    expect(db.answerJob(job.id, 'too late', t0 + 61_000)).toBe(false);
    expect(db.getJob(job.id)!.state).toBe('refunded');
    expect(db.getJob(job.id)!.answer).toBeNull();
  });

  it('a second sweep sends nothing (one transfer per job)', async () => {
    const a = newJob('pay1');
    const b = newJob('pay2');
    db.answerJob(b.id, 'ok', t0 + 1_000);
    await worker.tick(t0 + 60_000);
    expect(sol.transferToken).toHaveBeenCalledTimes(2);

    await worker.tick(t0 + 62_000);
    await worker.tick(t0 + 64_000);
    expect(sol.transferToken).toHaveBeenCalledTimes(2);
    expect(db.sweep({ expertWallet: expert, releaseUnits: 450_000n, refundUnits: 500_000n }, t0 + 99_000)).toEqual([]);
    const count = db.raw.prepare('SELECT job_id, COUNT(*) c FROM transfers GROUP BY job_id').all() as { c: number }[];
    expect(count).toHaveLength(2);
    expect(count.every((r) => r.c === 1)).toBe(true);
    expect(db.getTransferByJob(a.id)!.kind).toBe('refund');
    expect(db.getTransferByJob(b.id)!.kind).toBe('release');
  });

  it('unique index rejects a second transfer row for the same job', () => {
    const job = newJob('pay1');
    const ins = db.raw.prepare(
      `INSERT INTO transfers (id, job_id, kind, to_addr, amount, memo, status, created_at, updated_at)
       VALUES (?, ?, 'refund', 'x', 1, 'm', 'pending', 0, 0)`,
    );
    ins.run('t1', job.id);
    expect(() => ins.run('t2', job.id)).toThrow(/UNIQUE/);
  });

  it('failed send stays pending and is retried next tick without a second decision', async () => {
    const job = newJob('pay1');
    sol.transferToken.mockRejectedValueOnce(new Error('rpc down'));
    await worker.tick(t0 + 60_000);
    expect(db.getTransferByJob(job.id)!.status).toBe('pending');
    await worker.tick(t0 + 62_000);
    expect(sol.transferToken).toHaveBeenCalledTimes(2);
    expect(db.getTransferByJob(job.id)!.status).toBe('confirmed');
  });

  it('startup re-checks sent transfers by signature before sending anything', async () => {
    const job = newJob('pay1');
    const [t] = db.sweep({ expertWallet: expert, releaseUnits: 450_000n, refundUnits: 500_000n }, t0 + 60_000);
    db.markTransferSent(t.id, 'oldSig', t0 + 60_000);
    sol.statuses.set('oldSig', 'confirmed');

    await worker.start();
    worker.stop();

    expect(sol.getSignatureStatus).toHaveBeenCalledWith('oldSig');
    expect(sol.transferToken).not.toHaveBeenCalled();
    expect(db.getTransferByJob(job.id)).toMatchObject({ status: 'confirmed', tx_sig: 'oldSig' });
  });
});
