// Spike: POST /x/translate behind @x402/hono (V2 exact, Solana devnet, x402.org facilitator).
// Throwaway. Logs where the settlement signature + payer become visible:
//   (a) onAfterSettle hook, (b) PAYMENT-RESPONSE header read by an outer middleware after next().
import { readFileSync, appendFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { Hono, type MiddlewareHandler } from 'hono';
import { serve } from '@hono/node-server';
import { paymentMiddleware, x402ResourceServer } from '@x402/hono';
import { ExactSvmScheme } from '@x402/svm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import type { Network, Price } from '@x402/core/types';
import { Keypair } from '@solana/web3.js';

const NET: Network = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
const FACILITATOR = process.env.FACILITATOR_URL ?? 'https://x402.org/facilitator';
const PORT = Number(process.env.SPIKE_PORT ?? 4402);
const LOG = 'spike/fixtures/settle-sources.jsonl';

const holdSecret = JSON.parse(readFileSync(process.env.HOLD_KEYPAIR_PATH ?? 'keys/hold.json', 'utf8'));
const PAY_TO = Keypair.fromSecretKey(Uint8Array.from(holdSecret)).publicKey.toBase58();

// SPIKE_ASSET=usdc -> '$0.50' (devnet USDC via DEFAULT_ASSETS); otherwise the fallback test mint, explicit asset.
let price: Price = '$0.50';
if (process.env.SPIKE_ASSET !== 'usdc' && existsSync('keys/test-mint.json')) {
  const { mint } = JSON.parse(readFileSync('keys/test-mint.json', 'utf8'));
  price = { asset: mint, amount: '500000' }; // 0.50 at 6 decimals
}

mkdirSync('spike/fixtures', { recursive: true });
const record = (source: string, data: unknown) => {
  const line = { at: new Date().toISOString(), source, ...(data as object) };
  console.log(`[${source}]`, JSON.stringify(line));
  appendFileSync(LOG, JSON.stringify(line) + '\n');
};

const t: Record<string, number> = {};
const server = new x402ResourceServer(new HTTPFacilitatorClient({ url: FACILITATOR }))
  .register(NET, new ExactSvmScheme())
  .onBeforeVerify(async () => { t.verifyStart = Date.now(); })
  .onBeforeSettle(async () => { t.settleStart = Date.now(); })
  .onSettleFailure(async ({ error }) => { record('onSettleFailure', { error: String(error), ms: Date.now() - t.settleStart }); })
  .onAfterSettle(async ({ result }) => {
    t.settleEnd = Date.now();
    const timing = { verifyToSettleStartMs: t.settleStart - t.verifyStart, settleMs: t.settleEnd - t.settleStart, settleEndEpochMs: t.settleEnd };
    writeFileSync('spike/fixtures/settle.json', JSON.stringify({ at: new Date().toISOString(), timing, result }, null, 2));
    console.log('[settle raw]', JSON.stringify(result), JSON.stringify(timing));
    record('onAfterSettle', {
      success: result.success,
      transaction: result.transaction,
      payer: result.payer,
      network: result.network,
    });
  });

type Env = { Variables: { body: { text: string; sourceLang: string; targetLang: string } } };
const app = new Hono<Env>();

// Outer: runs around paymentMiddleware; after next() the settle has happened and c.res carries PAYMENT-RESPONSE.
const outer: MiddlewareHandler<Env> = async (c, next) => {
  await next();
  const h = c.res.headers.get('PAYMENT-RESPONSE');
  if (!h) {
    console.log(`[outer] status=${c.res.status} no PAYMENT-RESPONSE`);
    return;
  }
  const settle = JSON.parse(Buffer.from(h, 'base64').toString('utf8'));
  writeFileSync('spike/fixtures/payment-response.json', JSON.stringify({ at: new Date().toISOString(), status: c.res.status, header: h, decoded: settle }, null, 2));
  record('outer-PAYMENT-RESPONSE', {
    status: c.res.status,
    success: settle.success,
    transaction: settle.transaction,
    payer: settle.payer,
    network: settle.network,
    raw: settle,
  });
};

// Validate the JSON body before the 402 so malformed requests never get a price.
const validate: MiddlewareHandler<Env> = async (c, next) => {
  let b: any;
  try {
    b = await c.req.json();
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400);
  }
  if (!b || typeof b.text !== 'string' || !b.text.trim()) return c.json({ error: 'text is required' }, 400);
  if (typeof b.sourceLang !== 'string' || typeof b.targetLang !== 'string')
    return c.json({ error: 'sourceLang and targetLang are required' }, 400);
  c.set('body', { text: b.text, sourceLang: b.sourceLang, targetLang: b.targetLang });
  await next();
};

app.use('/x/translate', outer);
app.use('/x/translate', validate);
app.use(
  paymentMiddleware(
    {
      'POST /x/translate': {
        accepts: [{ scheme: 'exact', price, network: NET, payTo: PAY_TO }],
        description: 'Human translation job (spike)',
        mimeType: 'application/json',
      },
    },
    server,
  ),
);
app.post('/x/translate', (c) => c.json({ ok: true, accepted: c.get('body') }));

serve({ fetch: app.fetch, port: PORT });
console.log(`spike on :${PORT} payTo=${PAY_TO} price=${JSON.stringify(price)} facilitator=${FACILITATOR}`);
