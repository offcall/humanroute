// Spike step 5: replay the same PAYMENT-SIGNATURE twice, then try a 0.10 underpayment. Throwaway.
// The step-3 header was never captured, so this mints a fresh one, sends it once (settles), then resends it byte-identical.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { x402Client, x402HTTPClient } from '@x402/core/client';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

const URL_ = process.env.SPIKE_URL ?? 'http://localhost:4402/x/translate';
const NET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1' as const;
const conn = new Connection(process.env.RPC_URL ?? 'https://api.devnet.solana.com', 'confirmed');
const signer = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(readFileSync('keys/agent.json', 'utf8'))));
const testMint = JSON.parse(readFileSync('keys/test-mint.json', 'utf8')).mint as string;
const client = x402Client.fromConfig({
  schemes: [{ network: NET, client: new ExactSvmScheme(signer) }],
  spendControls: { allowedAssets: [{ network: NET, asset: testMint, maxAmountPerPayment: '500000' }] },
});
const http = new x402HTTPClient(client);
const body = JSON.stringify({ text: 'Hello world', sourceLang: 'en', targetLang: 'de' });

// Server overwrites these on every settle; keep the step-3 evidence intact.
const keep = ['spike/fixtures/settle.json', 'spike/fixtures/payment-response.json'];
for (const f of keep) if (existsSync(f)) copyFileSync(f, f + '.bak');

const mint = new PublicKey(testMint);
const agentAta = getAssociatedTokenAddressSync(mint, new PublicKey(signer.address));
const holdAta = new PublicKey('EyqH64PJpw63KdN1j6RJ5haRoXU4rkqKaGNwqc6iyuMW');
const bal = async () => ({
  agent: (await conn.getTokenAccountBalance(agentAta)).value.amount,
  hold: (await conn.getTokenAccountBalance(holdAta)).value.amount,
});

const send = async (headers: Record<string, string>) => {
  const t0 = Date.now();
  const r = await fetch(URL_, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
  const text = await r.text();
  const hdrs = Object.fromEntries(r.headers.entries());
  const dec = (h?: string) => { try { return h ? JSON.parse(Buffer.from(h, 'base64').toString('utf8')) : null; } catch { return h; } };
  let parsedBody: unknown = text;
  try { parsedBody = JSON.parse(text); } catch {}
  return {
    at: new Date().toISOString(), ms: Date.now() - t0, status: r.status, headers: hdrs, body: parsedBody,
    paymentResponseDecoded: dec(hdrs['payment-response']), paymentRequiredDecoded: dec(hdrs['payment-required']),
  };
};

const pr402 = await fetch(URL_, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
const paymentRequired = http.getPaymentRequiredResponse((n) => pr402.headers.get(n), await pr402.json().catch(() => undefined));

// --- replay ---
const before = await bal();
const payload = await client.createPaymentPayload(paymentRequired);
const sigHeaders = http.encodePaymentSignatureHeader(payload);
const first = await send(sigHeaders);
const afterFirst = await bal();
const second = await send(sigHeaders); // byte-identical header
const afterSecond = await bal();
writeFileSync('spike/fixtures/replay.json', JSON.stringify({
  note: 'Step-3 PAYMENT-SIGNATURE was not captured; a fresh header was created, sent once, then resent identically.',
  paymentSignatureHeader: sigHeaders,
  paymentPayload: payload,
  balances: { before, afterFirst, afterSecond },
  first, second,
}, null, 2));
console.log('replay first', first.status, first.paymentResponseDecoded, '\nreplay second', second.status, second.body, second.paymentResponseDecoded ?? second.paymentRequiredDecoded?.error);

// --- underpay: sign 0.10 against the server's 0.50 requirement ---
const under = structuredClone(paymentRequired);
under.accepts = under.accepts.map((a: any) => ({ ...a, amount: '100000' }));
const underPayload = await client.createPaymentPayload(under);
const underHeaders = http.encodePaymentSignatureHeader(underPayload);
const uBefore = await bal();
const u = await send(underHeaders);
await new Promise((r) => setTimeout(r, 5000));
const uAfter = await bal();
writeFileSync('spike/fixtures/underpay.json', JSON.stringify({
  note: 'Client signed a 100000 (0.10) transferChecked to payTo while the route requires 500000 (0.50).',
  paymentSignatureHeader: underHeaders, paymentPayload: underPayload,
  balances: { before: uBefore, after5s: uAfter }, response: u,
}, null, 2));
console.log('underpay', u.status, u.body, u.paymentResponseDecoded ?? u.paymentRequiredDecoded?.error, uBefore, uAfter);

// Preserve the replay's first settle separately, then restore step-3 fixtures.
if (existsSync('spike/fixtures/settle.json')) copyFileSync('spike/fixtures/settle.json', 'spike/fixtures/replay-first-settle.json');
for (const f of keep) if (existsSync(f + '.bak')) copyFileSync(f + '.bak', f);
