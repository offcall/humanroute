// Worker: sweeps decisions (paid past deadline -> refunded, answered -> released) and moves
// transfer rows through pending -> sent -> confirmed | failed. Job state and transfer status stay separate.
import type { Config } from './config.js';
import type { Db, Transfer } from './db.js';
import type { SolanaClient } from './solana.js';

export interface WorkerOptions {
  intervalMs?: number; // default 2000
  // A sent signature the RPC has never seen after this long is treated as dropped and resent.
  dropAfterMs?: number; // default 120000 (blockhash validity is ~60-90 s)
  log?: (msg: string) => void;
}

export function createWorker(db: Db, sol: SolanaClient, cfg: Config, opts: WorkerOptions = {}) {
  const intervalMs = opts.intervalMs ?? 2000;
  const dropAfterMs = opts.dropAfterMs ?? 120_000;
  const log = opts.log ?? ((m: string) => console.log(`[worker] ${m}`));
  const payouts = { expertWallet: cfg.expertWallet, releaseUnits: cfg.releaseUnits, refundUnits: cfg.refundUnits };
  let timer: ReturnType<typeof setInterval> | null = null;
  let busy = false;

  // Re-check every sent transfer by signature status; never resend one that may still land.
  async function recoverSent(now = Date.now()): Promise<void> {
    for (const t of db.listTransfers('sent')) {
      if (!t.tx_sig) continue;
      let s;
      try {
        s = await sol.getSignatureStatus(t.tx_sig);
      } catch (e) {
        log(`status check ${t.id} failed: ${String(e)}`);
        continue;
      }
      if (s === 'confirmed') db.markTransferConfirmed(t.id);
      else if (s === 'failed') db.markTransferFailed(t.id, 'on-chain error');
      else if (s === 'unknown' && now - t.updated_at > dropAfterMs) {
        db.resetTransferToPending(t.id, `dropped sig ${t.tx_sig}`);
        log(`transfer ${t.id} sig dropped, will resend`);
      }
    }
  }

  async function sendOne(t: Transfer): Promise<void> {
    let sig: string;
    try {
      sig = await sol.transferToken(t.to_addr, BigInt(t.amount), t.memo);
    } catch (e) {
      // Not sent: stays pending and is retried next tick.
      log(`send ${t.kind} ${t.job_id} failed: ${String(e)}`);
      return;
    }
    db.markTransferSent(t.id, sig);
    log(`sent ${t.kind} ${t.amount} to ${t.to_addr} sig=${sig}`);
    let ok = false;
    try {
      ok = await sol.confirmSignature(sig);
    } catch (e) {
      log(`confirm ${sig} error: ${String(e)}`);
    }
    if (ok) {
      db.markTransferConfirmed(t.id);
      return;
    }
    // Timeout or error: only mark failed if the chain says so, otherwise leave sent for recoverSent.
    try {
      if ((await sol.getSignatureStatus(sig)) === 'failed') db.markTransferFailed(t.id, 'on-chain error');
    } catch {
      /* rechecked next tick */
    }
  }

  async function tick(now = Date.now()): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      for (const t of db.sweep(payouts, now)) log(`decided ${t.kind} for job ${t.job_id}`);
      for (const t of db.listTransfers('pending')) await sendOne(t);
      await recoverSent(now);
    } finally {
      busy = false;
    }
  }

  return {
    tick,
    recoverSent,
    async start(): Promise<void> {
      // Startup: settle what was in flight before deciding or sending anything new.
      busy = true;
      try {
        await recoverSent();
      } finally {
        busy = false;
      }
      timer = setInterval(() => {
        tick().catch((e) => log(`tick error: ${String(e)}`));
      }, intervalMs);
    },
    stop(): void {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
