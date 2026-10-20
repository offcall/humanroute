// GET /jobs/:id?token= -> JSON status; GET /jobs/:id/view?token= -> auto-refreshing HTML view.
// The status token is the only auth; a missing job and a bad token both return 404.
import { timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import type { Db, Job } from '../db.js';

export interface JobsDeps {
  db: Db;
}

export function explorerUrl(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function tokenOk(job: Job, token: string | undefined) {
  if (!token) return false;
  const a = Buffer.from(job.status_token);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function jobStatus(db: Db, job: Job) {
  const t = db.getTransferByJob(job.id);
  const transfers = t
    ? [{ kind: t.kind, status: t.status, tx_sig: t.tx_sig, explorer_url: t.tx_sig ? explorerUrl(t.tx_sig) : null }]
    : [];
  // The answer is only handed out once the expert's payout is confirmed on-chain.
  const paidOut = t?.kind === 'release' && t.status === 'confirmed';
  return {
    state: job.state,
    refund_reason: job.refund_reason,
    viewed_at: job.viewed_at,
    deadline_at: job.deadline_at,
    answer: paidOut ? job.answer : null,
    transfers,
  };
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

const iso = (ms: number | null) => (ms == null ? '—' : new Date(ms).toISOString());

function renderView(id: string, s: ReturnType<typeof jobStatus>, now: number) {
  const left = Math.max(0, Math.ceil((s.deadline_at - now) / 1000));
  const rows = s.transfers
    .map(
      (t) =>
        `<li>${esc(t.kind)}: <b>${esc(t.status)}</b>${
          t.explorer_url ? ` — <a href="${esc(t.explorer_url)}" target="_blank" rel="noopener">explorer</a>` : ''
        }</li>`,
    )
    .join('');
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="2"><title>Job ${esc(id)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:40rem;margin:1rem auto;padding:0 1rem;color:#222}
.state{display:inline-block;padding:.2rem .6rem;border-radius:.4rem;background:#eee;font-weight:600}
.released{background:#d4f5d4}.refunded{background:#fde2c8}.answered{background:#dbe8ff}
dt{color:#666;font-size:.85rem;margin-top:.6rem}dd{margin:0}
pre{white-space:pre-wrap;background:#f6f6f6;padding:.6rem;border-radius:.4rem}
</style></head><body>
<h1>Job <small>${esc(id.slice(0, 8))}</small></h1>
<p><span class="state ${esc(s.state)}">${esc(s.state)}</span></p>
<dl>
<dt>Deadline</dt><dd>${iso(s.deadline_at)}${s.state === 'paid' ? ` (${left}s left)` : ''}</dd>
<dt>Viewed by expert</dt><dd>${iso(s.viewed_at)}</dd>
${s.refund_reason ? `<dt>Refund reason</dt><dd>${esc(s.refund_reason)}</dd>` : ''}
${s.answer != null ? `<dt>Answer</dt><dd><pre>${esc(s.answer)}</pre></dd>` : ''}
<dt>Transfers</dt><dd>${rows ? `<ul>${rows}</ul>` : 'none yet'}</dd>
</dl>
</body></html>`;
}

export function jobsRoutes(d: JobsDeps) {
  const app = new Hono();

  const load = (id: string, token: string | undefined) => {
    const job = d.db.getJob(id);
    return job && tokenOk(job, token) ? job : null;
  };

  app.get('/jobs/:id', (c) => {
    const job = load(c.req.param('id'), c.req.query('token'));
    if (!job) return c.json({ error: 'not found' }, 404);
    return c.json(jobStatus(d.db, job));
  });

  app.get('/jobs/:id/view', (c) => {
    const job = load(c.req.param('id'), c.req.query('token'));
    if (!job) return c.text('not found', 404);
    return c.html(renderView(job.id, jobStatus(d.db, job), Date.now()));
  });

  return app;
}
