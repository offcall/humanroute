// Throwaway: pay once through the gateway, capture the PAYMENT-SIGNATURE header, then replay it
// with the same body and with a different body. Expect: same 202 (same jobId), then 409.
import { readFileSync } from 'node:fs';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { x402Client } from '@x402/core/client';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import { wrapFetchWithPayment } from '@x402/fetch';

const URL_ = process.env.GATEWAY_URL ?? 'http://localhost:4021';
const secret = Uint8Array.from(JSON.parse(readFileSync('keys/agent.json', 'utf8')));
const signer = await createKeyPairSignerFromBytes(secret);
const NET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1' as const;
const mint = JSON.parse(readFileSync('keys/test-mint.json', 'utf8')).mint as string;
const client = x402Client.fromConfig({
  schemes: [{ network: NET, client: new ExactSvmScheme(signer) }],
  spendControls: { allowedAssets: [{ network: NET, asset: mint, maxAmountPerPayment: '500000' }] },
});
let captured: string | null = null;
const spyFetch: typeof fetch = async (input, init) => {
  const h = new Headers(init?.headers);
  const ih = input instanceof Request ? input.headers : new Headers();
  const sig = h.get('PAYMENT-SIGNATURE') ?? ih.get('PAYMENT-SIGNATURE');
  console.log('fetch call, header names:', [...h.keys(), ...ih.keys()].join(','));
  if (sig) captured = sig;
  return fetch(input, init);
};
const fetchWithPayment = wrapFetchWithPayment(spyFetch, client);
const body = JSON.stringify({ text: 'Replay test sentence', sourceLang: 'en', targetLang: 'de' });
const first = await fetchWithPayment(`${URL_}/x/translate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
const firstBody = await first.json() as { jobId?: string };
console.log('first:', first.status, firstBody.jobId);
if (!captured) throw new Error('no PAYMENT-SIGNATURE captured');
const replay = async (label: string, b: string) => {
  const r = await fetch(`${URL_}/x/translate`, { method: 'POST', headers: { 'content-type': 'application/json', 'PAYMENT-SIGNATURE': captured as string }, body: b });
  const t = await r.text();
  console.log(label + ':', r.status, t.slice(0, 160));
};
await replay('replay same body', body);
await replay('replay same body again', body);
await replay('replay other body', JSON.stringify({ text: 'A different sentence', sourceLang: 'en', targetLang: 'de' }));
