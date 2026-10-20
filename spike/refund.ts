// Spike: refund the payer from the hold wallet (TransferChecked + Memo 'hr:spike:<paymentSig>'). Throwaway.
// Mint, amount, decimals and token program are read from the settled payment tx, so it works for USDC or the fallback mint.
import { readFileSync, writeFileSync } from 'node:fs';
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createTransferCheckedInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';

const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const conn = new Connection(process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com', 'confirmed');
const hold = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync('keys/hold.json', 'utf8'))));
const settle = JSON.parse(readFileSync('spike/fixtures/settle.json', 'utf8'));
const paymentSig: string = settle.result.transaction;
const payer = new PublicKey(settle.result.payer);

const ptx = await conn.getParsedTransaction(paymentSig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
if (!ptx || ptx.meta?.err) throw new Error(`payment tx not found/failed: ${paymentSig}`);
const xfer: any = ptx.transaction.message.instructions.find((i: any) => i.parsed?.type === 'transferChecked');
if (!xfer) throw new Error('no transferChecked in payment tx');
const mint = new PublicKey(xfer.parsed.info.mint);
const amount = BigInt(xfer.parsed.info.tokenAmount.amount);
const decimals: number = xfer.parsed.info.tokenAmount.decimals;
const tokenProgram = xfer.programId as PublicKey;

const holdAta = getAssociatedTokenAddressSync(mint, hold.publicKey, false, tokenProgram);
const payerAta = getAssociatedTokenAddressSync(mint, payer, false, tokenProgram);
const before = {
  hold: (await conn.getTokenAccountBalance(holdAta)).value.amount,
  payer: (await conn.getTokenAccountBalance(payerAta)).value.amount,
};
const memo = `hr:spike:${paymentSig}`;
const tx = new Transaction().add(
  createTransferCheckedInstruction(holdAta, mint, payerAta, hold.publicKey, amount, decimals, [], tokenProgram),
  new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [], data: Buffer.from(memo, 'utf8') }),
);
const t0 = Date.now();
const sig = await sendAndConfirmTransaction(conn, tx, [hold], { commitment: 'confirmed' });
const confirmMs = Date.now() - t0;
const rtx = await conn.getParsedTransaction(sig, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
const after = {
  hold: (await conn.getTokenAccountBalance(holdAta)).value.amount,
  payer: (await conn.getTokenAccountBalance(payerAta)).value.amount,
};
const out = {
  at: new Date().toISOString(),
  signature: sig,
  explorer: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
  paymentSignature: paymentSig,
  memo,
  mint: mint.toBase58(),
  tokenProgram: tokenProgram.toBase58(),
  amount: amount.toString(),
  decimals,
  from: { owner: hold.publicKey.toBase58(), ata: holdAta.toBase58() },
  to: { owner: payer.toBase58(), ata: payerAta.toBase58() },
  confirmMs,
  slot: rtx?.slot,
  err: rtx?.meta?.err ?? null,
  feeLamports: rtx?.meta?.fee,
  feePayer: rtx?.transaction.message.accountKeys[0].pubkey.toBase58(),
  logMemo: rtx?.meta?.logMessages?.find((l) => l.includes('Memo')),
  balancesBefore: before,
  balancesAfter: after,
};
writeFileSync('spike/fixtures/refund.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log(`\nREFUND ${sig}\n${out.explorer}`);
