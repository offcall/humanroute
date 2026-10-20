// Spike: poll getTransaction(confirmed) for the settle signature; check fee payer + balance deltas. Throwaway.
import { readFileSync, writeFileSync } from 'node:fs';
import { Connection } from '@solana/web3.js';
const conn = new Connection(process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com', 'confirmed');
const settle = JSON.parse(readFileSync('spike/fixtures/settle.json', 'utf8'));
const sig: string = settle.result.transaction;
const AGENT = settle.result.payer as string;
const start = Date.now();
let tx = null, polls = 0;
while (!tx && Date.now() - start < 60_000) {
  polls++;
  tx = await conn.getParsedTransaction(sig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
  if (!tx) await new Promise((r) => setTimeout(r, 500));
}
const foundAt = Date.now();
if (!tx) { console.log('NOT FOUND', sig); process.exit(1); }
const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
const idx = keys.indexOf(AGENT);
const out = {
  signature: sig,
  payer: AGENT,
  slot: tx.slot,
  blockTime: tx.blockTime,
  err: tx.meta?.err ?? null,
  feeLamports: tx.meta?.fee,
  feePayer: keys[0],
  signers: tx.transaction.message.accountKeys.filter((k) => k.signer).map((k) => k.pubkey.toBase58()),
  agentInTx: idx >= 0,
  agentLamportsPre: idx >= 0 ? tx.meta?.preBalances[idx] : null,
  agentLamportsPost: idx >= 0 ? tx.meta?.postBalances[idx] : null,
  agentCurrentLamports: await conn.getBalance(new (await import('@solana/web3.js')).PublicKey(AGENT), 'confirmed'),
  tokenPre: tx.meta?.preTokenBalances,
  tokenPost: tx.meta?.postTokenBalances,
  instructions: tx.transaction.message.instructions.map((i: any) => ({ program: i.program ?? i.programId.toBase58(), type: i.parsed?.type, info: i.parsed?.info })),
  timing: {
    settleMs: settle.timing.settleMs,
    verifyToSettleStartMs: settle.timing.verifyToSettleStartMs,
    settleEndToConfirmedFoundMs: foundAt - settle.timing.settleEndEpochMs,
    confirmPollMs: foundAt - start,
    polls,
    note: 'settleEndToConfirmedFoundMs includes delay before this script started',
  },
  explorer: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
};
writeFileSync('spike/fixtures/confirm.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
