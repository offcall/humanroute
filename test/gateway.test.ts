// POST /x/translate through the real @x402/hono middleware with a fake facilitator (no network, no chain).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { Keypair } from '@solana/web3.js';
import type { FacilitatorClient } from '@x402/core/server';
import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from '@x402/core/http';
import { loadConfig } from '../src/config.js';
import { openDb, type Db } from '../src/db.js';
import { createApp } from '../src/server.js';

const payer = Keypair.generate().publicKey.toBase58();
const payTo = Keypair.generate().publicKey.toBase58();
const feePayer = Keypair.generate().publicKey.toBase58();
const cfg = loadConfig({ EXPERT_WALLET: Keypair.generate().publicKey.toBase58(), DB_PATH: ':memory:' });
const body = { text: 'Hello world', sourceLang: 'en', targetLang: 'de' };

function fakeFacilitator() {
  let n = 0;
  return {
    verify: vi.fn(async () => ({ isValid: true, payer })),
    // Mocked settle: each call returns a fresh "on-chain" signature.
    settle: vi.fn(async (_p: unknown, req: { network: string }) => ({
      success: true,
      transaction: `settleSig${++n}`,
      network: req.network,
      payer,
    })),
    getSupported: vi.fn(async () => ({
      kinds: [{ x402Version: 2, scheme: 'exact', network: cfg.network, extra: { feePayer } }],
      extensions: [],
      signers: {},
    })),
  };
}

// Fake signed tx: 1 signature (64 bytes) + random "message" bytes; paymentId hashes the message part.
function fakeTx(): string {
  return Buffer.concat([Buffer.from([1]), Buffer.alloc(64), randomBytes(48)]).toString('base64');
}

describe('POST /x/translate', () => {
  let db: Db;
  let fac: ReturnType<typeof fakeFacilitator>;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = openDb(':memory:');
    fac = fakeFacilitator();
    app = createApp({ cfg, db, facilitator: fac as unknown as FacilitatorClient, payTo });
  });
  afterEach(() => db.close());

  const post = (b: unknown, headers: Record<string, string> = {}) =>
    app.request('/x/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof b === 'string' ? b : JSON.stringify(b),
    });

  async function paymentHeader(tx = fakeTx()): Promise<string> {
    const res = await post(body);
    expect(res.status).toBe(402);
    const required = decodePaymentRequiredHeader(res.headers.get('PAYMENT-REQUIRED')!);
    return encodePaymentSignatureHeader({
      x402Version: required.x402Version,
      resource: required.resource,
      accepted: required.accepts[0],
      payload: { transaction: tx },
    } as never);
  }

  it('rejects an invalid body with 400 before any 402', async () => {
    const res = await post({ text: '', sourceLang: 'en', targetLang: 'de' });
    expect(res.status).toBe(400);
    expect(fac.verify).not.toHaveBeenCalled();
  });

  it('returns 402 with price from config when unpaid', async () => {
    const res = await post(body);
    expect(res.status).toBe(402);
    const required = decodePaymentRequiredHeader(res.headers.get('PAYMENT-REQUIRED')!);
    expect(required.accepts[0].amount).toBe(cfg.priceUnits.toString());
    expect(required.accepts[0].payTo).toBe(payTo);
  });

  it('settles, inserts a paid job keyed by the settlement signature and returns 202', async () => {
    const res = await post(body, { 'PAYMENT-SIGNATURE': await paymentHeader() });
    expect(res.status).toBe(202);
    const json = (await res.json()) as { jobId: string; statusUrl: string; statusToken: string };
    expect(json.jobId).toBeTruthy();
    expect(json.statusUrl).toContain(json.jobId);
    expect(fac.verify).toHaveBeenCalledTimes(1);
    expect(fac.settle).toHaveBeenCalledTimes(1);
    expect(decodePaymentResponseHeader(res.headers.get('PAYMENT-RESPONSE')!).transaction).toBe('settleSig1');

    const job = db.getJob(json.jobId)!;
    expect(job.state).toBe('paid');
    expect(job.pay_tx).toBe('settleSig1');
    expect(job.payer).toBe(payer);
    expect(job.status_token).toBe(json.statusToken);
    expect(job.deadline_at - job.created_at).toBe(cfg.slaSeconds * 1000);
  });

  it('replayed PAYMENT-SIGNATURE returns the same job without a second job or settle', async () => {
    const header = await paymentHeader();
    const first = (await (await post(body, { 'PAYMENT-SIGNATURE': header })).json()) as { jobId: string };
    const res2 = await post(body, { 'PAYMENT-SIGNATURE': header });
    expect(res2.status).toBe(202);
    const second = (await res2.json()) as { jobId: string };
    expect(second.jobId).toBe(first.jobId);
    expect(db.listJobs()).toHaveLength(1);
    expect(fac.settle).toHaveBeenCalledTimes(1);
  });

  it('db: same pay_tx inserted twice yields one job', () => {
    const j = { payTx: 'sigX', payer, text: 't', sourceLang: 'en', targetLang: 'de', slaSeconds: 60 };
    const a = db.insertPaidJob(j);
    const b = db.insertPaidJob(j);
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.job.id).toBe(a.job.id);
    expect(db.listJobs()).toHaveLength(1);
  });
});
