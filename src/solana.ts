// Solana layer: hold wallet sends USDC (TransferChecked + Memo) for releases and refunds.
// Behind the SolanaClient interface so tests can mock it; real impl not yet run on devnet.
import { readFileSync } from 'node:fs';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  type Commitment,
} from '@solana/web3.js';
import { createTransferCheckedInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export type SigStatus = 'pending' | 'confirmed' | 'failed' | 'unknown';

export interface SolanaClient {
  /** Sends TransferChecked hold ATA -> recipient ATA plus a Memo; returns the signature once sent (not confirmed). */
  transferToken(toWallet: string, amountBaseUnits: bigint, memo: string): Promise<string>;
  /** Waits until the signature is confirmed; resolves true on success, false on on-chain error or timeout. */
  confirmSignature(sig: string): Promise<boolean>;
  /** One-shot status lookup ('unknown' = RPC has never seen it). */
  getSignatureStatus(sig: string): Promise<SigStatus>;
  holdAddress(): string;
}

export interface SolanaOptions {
  rpcUrl: string;
  mint: string;
  decimals?: number;
  holdKeypairPath: string;
  commitment?: Commitment;
  confirmTimeoutMs?: number;
}

export function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, 'utf8'))));
}

export function createSolanaClient(opts: SolanaOptions): SolanaClient {
  const commitment = opts.commitment ?? 'confirmed';
  const conn = new Connection(opts.rpcUrl, commitment);
  const hold = loadKeypair(opts.holdKeypairPath);
  const mint = new PublicKey(opts.mint);
  const decimals = opts.decimals ?? 6;
  const fromAta = getAssociatedTokenAddressSync(mint, hold.publicKey);
  const timeoutMs = opts.confirmTimeoutMs ?? 60_000;

  async function getSignatureStatus(sig: string): Promise<SigStatus> {
    const { value } = await conn.getSignatureStatuses([sig], { searchTransactionHistory: true });
    const s = value[0];
    if (!s) return 'unknown';
    if (s.err) return 'failed';
    if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') return 'confirmed';
    return 'pending';
  }

  return {
    holdAddress: () => hold.publicKey.toBase58(),

    async transferToken(toWallet, amountBaseUnits, memo) {
      const owner = new PublicKey(toWallet);
      // Recipient ATA must already exist (setup-wallets creates them); not created here.
      const toAta = getAssociatedTokenAddressSync(mint, owner);
      const tx = new Transaction().add(
        createTransferCheckedInstruction(fromAta, mint, toAta, hold.publicKey, amountBaseUnits, decimals),
        new TransactionInstruction({
          programId: MEMO_PROGRAM_ID,
          keys: [{ pubkey: hold.publicKey, isSigner: true, isWritable: false }],
          data: Buffer.from(memo, 'utf8'),
        }),
      );
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash(commitment);
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = hold.publicKey;
      tx.sign(hold);
      return conn.sendRawTransaction(tx.serialize(), { preflightCommitment: commitment });
    },

    async confirmSignature(sig) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const s = await getSignatureStatus(sig);
        if (s === 'confirmed') return true;
        if (s === 'failed') return false;
        await new Promise((r) => setTimeout(r, 1000));
      }
      return false;
    },

    getSignatureStatus,
  };
}
