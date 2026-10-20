// escalateToHuman(): pay POST /x/translate with @x402/fetch (agent keypair), then poll the status URL.
import { readFileSync } from 'node:fs';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from '@x402/fetch';
import { registerExactSvmScheme } from '@x402/svm/exact/client';

export const GATEWAY_URL = (process.env.GATEWAY_URL ?? `http://localhost:${process.env.PORT ?? 4021}`).replace(/\/$/, '');

export interface Transfer {
  kind: string;
  status: string;
  tx_sig: string | null;
  explorer_url: string | null;
}

export interface JobStatus {
  state: string;
  refund_reason: string | null;
  viewed_at: string | number | null;
  deadline_at: string | number | null;
  answer?: string | null;
  transfers: Transfer[];
}

export interface EscalateRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
  draft?: string;
  meta?: { clauseId?: string; confidence?: number };
}

export interface Escalation {
  jobId: string;
  statusUrl: string; // absolute
  payTx: string | null;
  payer: string | null;
}

export function explorerTx(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

let paidFetch: ReturnType<typeof wrapFetchWithPayment> | undefined;

async function getPaidFetch() {
  if (paidFetch) return paidFetch;
  const path = process.env.AGENT_KEYPAIR ?? 'keys/agent.json';
  const signer = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(readFileSync(path, 'utf8'))));
  const client = new x402Client();
  registerExactSvmScheme(client, { signer });
  paidFetch = wrapFetchWithPayment(fetch, client);
  return paidFetch;
}

export async function escalateToHuman(req: EscalateRequest): Promise<Escalation> {
  const pay = await getPaidFetch();
  const res = await pay(`${GATEWAY_URL}/x/translate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status !== 202 || typeof body.jobId !== 'string' || typeof body.statusUrl !== 'string') {
    throw new Error(`escalation failed: HTTP ${res.status} ${JSON.stringify(body)}`);
  }
  const header = res.headers.get('PAYMENT-RESPONSE');
  const settle = header ? decodePaymentResponseHeader(header) : undefined;
  return {
    jobId: body.jobId,
    statusUrl: new URL(body.statusUrl, GATEWAY_URL + '/').toString(),
    payTx: settle?.transaction ?? null,
    payer: settle?.payer ?? null,
  };
}

const TERMINAL = new Set(['released', 'refunded']);

// Done once the job is released/refunded and its terminal transfer has settled (confirmed or failed).
function isDone(s: JobStatus): boolean {
  if (!TERMINAL.has(s.state)) return false;
  const kind = s.state === 'released' ? 'release' : 'refund';
  return s.transfers.some((t) => t.kind === kind && (t.status === 'confirmed' || t.status === 'failed'));
}

export async function pollStatus(
  statusUrl: string,
  opts: { intervalMs?: number; timeoutMs?: number; onTick?: (s: JobStatus) => void } = {},
): Promise<JobStatus> {
  const interval = opts.intervalMs ?? 2000;
  const until = Date.now() + (opts.timeoutMs ?? 10 * 60_000);
  for (;;) {
    const res = await fetch(statusUrl);
    if (res.ok) {
      const s = (await res.json()) as JobStatus;
      opts.onTick?.(s);
      if (isDone(s)) return s;
    } else if (res.status === 404) {
      throw new Error(`status 404 for ${statusUrl}`);
    }
    if (Date.now() > until) throw new Error('timed out waiting for job to finish');
    await new Promise((r) => setTimeout(r, interval));
  }
}
