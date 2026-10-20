// POST /x/translate: validate body -> replay check -> x402 verify -> handler -> settle -> insert paid job.
// The job is keyed by the settlement tx signature from PAYMENT-RESPONSE, so it only exists once money moved.
import { createHash } from 'node:crypto';
import { Hono, type MiddlewareHandler } from 'hono';
import { paymentMiddleware, x402ResourceServer } from '@x402/hono';
import { ExactSvmScheme } from '@x402/svm/exact/server';
import type { FacilitatorClient } from '@x402/core/server';
import { decodePaymentResponseHeader, decodePaymentSignatureHeader } from '@x402/core/http';
import type { Network } from '@x402/core/types';
import type { Config } from '../config.js';
import type { Db, Job } from '../db.js';

export interface XDeps {
  db: Db;
  cfg: Config;
  facilitator: FacilitatorClient; // HTTPFacilitatorClient in prod, a fake in tests
  payTo: string; // hold wallet address
  syncFacilitatorOnStart?: boolean; // tests pass false to skip GET /supported
}

interface TranslateBody {
  text: string;
  sourceLang: string;
  targetLang: string;
}

type Env = { Variables: { body: TranslateBody; payId: string | null } };

const LANG = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

function parseBody(raw: unknown): TranslateBody | string {
  if (!raw || typeof raw !== 'object') return 'body must be a JSON object';
  const b = raw as Record<string, unknown>;
  if (typeof b.text !== 'string' || !b.text.trim()) return 'text is required';
  if (b.text.length > 5000) return 'text too long (max 5000)';
  if (typeof b.sourceLang !== 'string' || !LANG.test(b.sourceLang)) return 'sourceLang must be a language code';
  if (typeof b.targetLang !== 'string' || !LANG.test(b.targetLang)) return 'targetLang must be a language code';
  return { text: b.text, sourceLang: b.sourceLang, targetLang: b.targetLang };
}

// Payment identity = hash of the Solana tx message bytes (signatures stripped), so a replay of the
// same PAYMENT-SIGNATURE is recognised even if the header is re-serialised. Falls back to the raw tx string.
export function paymentId(header: string | undefined): string | null {
  if (!header) return null;
  try {
    const p = decodePaymentSignatureHeader(header);
    const tx = (p.payload as Record<string, unknown>)?.transaction;
    if (typeof tx !== 'string') return null;
    const buf = Buffer.from(tx, 'base64');
    // compact-u16 signature count, then 64 bytes per signature, then the message
    let n = 0, shift = 0, i = 0;
    for (; i < 3; i++) {
      n |= (buf[i] & 0x7f) << shift;
      shift += 7;
      if ((buf[i] & 0x80) === 0) break;
    }
    const off = i + 1 + n * 64;
    const msg = off < buf.length ? buf.subarray(off) : Buffer.from(tx);
    return createHash('sha256').update(msg).digest('hex');
  } catch {
    return null;
  }
}

export function accepted(job: Job) {
  return {
    jobId: job.id,
    statusUrl: `/jobs/${job.id}?token=${job.status_token}`,
    statusToken: job.status_token,
  };
}

export function xRoutes(d: XDeps) {
  const app = new Hono<Env>();
  // payment id -> pay_tx; in-memory, so replays are only recognised until restart (pay_tx stays unique in DB).
  const seen = new Map<string, string>();
  const inflight = new Set<string>();

  const server = new x402ResourceServer(d.facilitator)
    .register(d.cfg.network as Network, new ExactSvmScheme())
    .onAfterSettle(async ({ result }) => {
      console.log(`[x402] settle success=${result.success} tx=${result.transaction} payer=${result.payer}`);
    });

  // 1) Validate before any 402 so a bad request is never charged.
  // Exception: an empty unpaid POST is a price probe and falls through to the 402 (nothing can be charged).
  const validate: MiddlewareHandler<Env> = async (c, next) => {
    const paid = !!(c.req.header('payment-signature') ?? c.req.header('x-payment'));
    if (!paid && !(await c.req.text()).trim()) return next();
    let raw: unknown;
    try {
      raw = await c.req.json(); // Hono caches the body; the x402 adapter can read it again
    } catch {
      return c.json({ error: 'invalid JSON body' }, 400);
    }
    const body = parseBody(raw);
    if (typeof body === 'string') return c.json({ error: body }, 400);
    c.set('body', body);
    await next();
  };

  // 2) Replay of a known payment returns the cached 202 without verify/settle; after settle, create the job.
  const recordPaid: MiddlewareHandler<Env> = async (c, next) => {
    const id = paymentId(c.req.header('payment-signature') ?? c.req.header('x-payment'));
    if (id) {
      const payTx = seen.get(id);
      const known = payTx ? d.db.getJobByPayTx(payTx) : undefined;
      if (known) return c.json(accepted(known), 202);
      if (inflight.has(id)) return c.json({ error: 'payment already in progress' }, 409);
      inflight.add(id);
    }
    try {
      await next();
      const header = c.res.headers.get('PAYMENT-RESPONSE');
      if (c.res.status !== 202 || !header) return; // 402 / 4xx / 5xx pass through untouched
      const settle = decodePaymentResponseHeader(header);
      if (!settle.success || !settle.transaction || !settle.payer) {
        c.res = c.json({ error: 'settlement incomplete', settle }, 502);
        return;
      }
      const b = c.get('body');
      const { job } = d.db.insertPaidJob({
        payTx: settle.transaction,
        payer: settle.payer,
        text: b.text,
        sourceLang: b.sourceLang,
        targetLang: b.targetLang,
        slaSeconds: d.cfg.slaSeconds,
      });
      if (id) seen.set(id, settle.transaction);
      c.res = c.json(accepted(job), 202, { 'PAYMENT-RESPONSE': header });
    } finally {
      if (id) inflight.delete(id);
    }
  };

  app.post('/x/translate', validate, recordPaid);
  app.use(
    paymentMiddleware(
      {
        'POST /x/translate': {
          accepts: [{ scheme: 'exact', price: `$${d.cfg.priceUsdc}`, network: d.cfg.network as Network, payTo: d.payTo }],
          description: 'Human translation job',
          mimeType: 'application/json',
        },
      },
      server,
      undefined,
      undefined,
      d.syncFacilitatorOnStart ?? true,
    ),
  );
  // Placeholder 202: the real body (jobId) is written by recordPaid once settlement is known.
  app.post('/x/translate', (c) => c.json({ pending: true }, 202));

  return app;
}
