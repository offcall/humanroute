// Spike client: POST /x/translate via @x402/fetch with the agent keypair. Throwaway.
import { readFileSync } from 'node:fs';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { x402Client } from '@x402/core/client';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import { wrapFetchWithPayment } from '@x402/fetch';

const URL_ = process.env.SPIKE_URL ?? 'http://localhost:4402/x/translate';
const secret = Uint8Array.from(JSON.parse(readFileSync(process.env.AGENT_KEYPAIR_PATH ?? 'keys/agent.json', 'utf8')));
const signer = await createKeyPairSignerFromBytes(secret);
const NET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1' as const;
// Fallback test mint is not a default asset: client spend controls reject it unless allow-listed.
const testMint = JSON.parse(readFileSync('keys/test-mint.json', 'utf8')).mint as string;
const client = x402Client.fromConfig({
  schemes: [{ network: NET, client: new ExactSvmScheme(signer) }],
  spendControls: { allowedAssets: [{ network: NET, asset: testMint, maxAmountPerPayment: '500000' }] },
});
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const t0 = Date.now();
const res = await fetchWithPayment(URL_, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ text: 'Hello world', sourceLang: 'en', targetLang: 'de' }),
});
const t1 = Date.now();
const h = res.headers.get('PAYMENT-RESPONSE');
console.log(JSON.stringify({
  agent: signer.address,
  status: res.status,
  body: await res.text(),
  paymentResponse: h ? JSON.parse(Buffer.from(h, 'base64').toString('utf8')) : null,
  roundTripMs: t1 - t0,
  doneEpochMs: t1,
}, null, 2));
