// Translator inbox (magic link, demo auth only): GET /inbox/:token lists paid jobs,
// GET /inbox/:token/jobs/:id opens one (sets viewed_at), POST .../answer submits the translation.
// The answer is accepted only while the job is paid and before its deadline (atomic in db.answerJob), else 409.
import { timingSafeEqual } from 'node:crypto';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import type { Config } from '../config.js';
import type { Db, Job } from '../db.js';

export interface InboxDeps {
  db: Db;
  cfg: Pick<Config, 'inboxToken'>;
}

const MAX_ANSWER = 10000;

function tokenOk(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function remaining(job: Job, now: number): number {
  return Math.max(0, Math.ceil((job.deadline_at - now) / 1000));
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;font:16px/1.45 -apple-system,system-ui,sans-serif;background:#f4f4f6;color:#111}
main{max-width:640px;margin:0 auto;padding:16px}
h1{font-size:20px;margin:4px 0 16px}
a{color:inherit;text-decoration:none}
.card{display:block;background:#fff;border-radius:12px;padding:14px;margin:0 0 12px;box-shadow:0 1px 3px #0002}
.meta{display:flex;justify-content:space-between;font-size:13px;color:#666;margin-bottom:8px}
.left{font-weight:600;color:#b45309}
.left.over{color:#b91c1c}
.label{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#888;margin:10px 0 2px}
.text{white-space:pre-wrap}
.draft{white-space:pre-wrap;color:#555;font-style:italic}
textarea{width:100%;min-height:140px;font:inherit;padding:10px;border:1px solid #ccc;border-radius:8px}
button{width:100%;margin-top:10px;padding:14px;font:inherit;font-weight:600;border:0;border-radius:8px;background:#111;color:#fff}
.empty{color:#888;text-align:center;padding:40px 0}
.msg{background:#fff;border-radius:12px;padding:14px;margin-bottom:12px}
.msg.err{border-left:4px solid #b91c1c}
.msg.ok{border-left:4px solid #15803d}
`;

// Ticks every [data-left] countdown once per second; purely cosmetic, the server enforces the deadline.
const TICK = `<script>
setInterval(function(){document.querySelectorAll('[data-left]').forEach(function(el){
var s=Math.max(0,+el.dataset.left-1);el.dataset.left=s;el.textContent=s>0?s+'s left':'expired';
if(s===0)el.classList.add('over');});},1000);
</script>`;

function page(title: string, body: string, opts: { refresh?: number } = {}): string {
  const refresh = opts.refresh ? `<meta http-equiv="refresh" content="${opts.refresh}">` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">${refresh}
<title>${esc(title)}</title><style>${CSS}</style></head>
<body><main>${body}</main>${TICK}</body></html>`;
}

function countdown(job: Job, now: number): string {
  const s = remaining(job, now);
  return `<span class="left${s === 0 ? ' over' : ''}" data-left="${s}">${s > 0 ? `${s}s left` : 'expired'}</span>`;
}

function jobBlocks(job: Job): string {
  return `<div class="label">${esc(job.source_lang)} source</div><div class="text">${esc(job.text)}</div>
<div class="label">MT draft (${esc(job.target_lang)})</div><div class="draft">${job.draft ? esc(job.draft) : '—'}</div>`;
}

function wantsJson(c: Context): boolean {
  return (c.req.header('content-type') ?? '').includes('application/json') ||
    (c.req.header('accept') ?? '').includes('application/json');
}

export function inboxRoutes(d: InboxDeps) {
  const app = new Hono();

  const auth: MiddlewareHandler = async (c, next) => {
    if (!tokenOk(c.req.param('token') ?? '', d.cfg.inboxToken)) return c.text('not found', 404);
    await next();
  };
  app.use('/inbox/:token', auth);
  app.use('/inbox/:token/*', auth);

  app.get('/inbox/:token', (c) => {
    const token = c.req.param('token');
    const now = Date.now();
    const jobs = d.db.listJobs('paid').filter((j) => j.deadline_at > now);
    const cards = jobs
      .map(
        (j) => `<a class="card" href="/inbox/${encodeURIComponent(token)}/jobs/${encodeURIComponent(j.id)}">
<div class="meta"><span>${esc(j.source_lang)} → ${esc(j.target_lang)}${j.viewed_at ? ' · opened' : ' · new'}</span>${countdown(j, now)}</div>
${jobBlocks(j)}</a>`,
      )
      .join('');
    const body = `<h1>Inbox · ${jobs.length} waiting</h1>${cards || '<div class="empty">No jobs waiting. This page refreshes itself.</div>'}`;
    return c.html(page('HumanRoute inbox', body, { refresh: 5 }));
  });

  app.get('/inbox/:token/jobs/:id', (c) => {
    const token = c.req.param('token');
    const id = c.req.param('id');
    if (!d.db.getJob(id)) return c.text('job not found', 404);
    d.db.markViewed(id);
    const job = d.db.getJob(id)!;
    const now = Date.now();
    const back = `<p><a href="/inbox/${encodeURIComponent(token)}">← Inbox</a></p>`;
    const open = job.state === 'paid' && job.deadline_at > now;
    const form = open
      ? `<form method="post" action="/inbox/${encodeURIComponent(token)}/jobs/${encodeURIComponent(job.id)}/answer">
<div class="label">Your translation</div>
<textarea name="answer" required maxlength="${MAX_ANSWER}">${esc(job.draft ?? '')}</textarea>
<button type="submit">Submit translation</button></form>`
      : `<div class="msg err">This job is ${job.state === 'paid' ? 'past its deadline' : esc(job.state)}; answers are closed.</div>`;
    const body = `${back}<div class="card"><div class="meta"><span>${esc(job.source_lang)} → ${esc(job.target_lang)}</span>${
      open ? countdown(job, now) : `<span>${esc(job.state)}</span>`
    }</div>${jobBlocks(job)}${form}</div>`;
    return c.html(page('HumanRoute job', body));
  });

  app.post('/inbox/:token/jobs/:id/answer', async (c) => {
    const token = c.req.param('token');
    const id = c.req.param('id');
    const json = wantsJson(c);
    let answer: unknown;
    try {
      if ((c.req.header('content-type') ?? '').includes('application/json')) {
        answer = ((await c.req.json()) as Record<string, unknown>)?.answer;
      } else {
        answer = (await c.req.parseBody()).answer;
      }
    } catch {
      return json ? c.json({ error: 'invalid body' }, 400) : c.text('invalid body', 400);
    }
    const reply = (status: 400 | 404 | 409, error: string) =>
      json
        ? c.json({ error }, status)
        : c.html(page('HumanRoute', `<p><a href="/inbox/${encodeURIComponent(token)}">← Inbox</a></p><div class="msg err">${esc(error)}</div>`), status);

    if (typeof answer !== 'string' || !answer.trim()) return reply(400, 'answer is required');
    if (answer.length > MAX_ANSWER) return reply(400, `answer too long (max ${MAX_ANSWER})`);
    const job = d.db.getJob(id);
    if (!job) return reply(404, 'job not found');
    if (!d.db.answerJob(id, answer.trim())) {
      const cur = d.db.getJob(id)!;
      return reply(409, cur.state === 'paid' ? 'deadline has passed' : `job is ${cur.state}`);
    }
    if (json) return c.json({ ok: true, jobId: id, state: 'answered' });
    return c.html(
      page('HumanRoute', `<p><a href="/inbox/${encodeURIComponent(token)}">← Inbox</a></p><div class="msg ok">Translation submitted. Payout follows once the worker releases it.</div>`),
    );
  });

  return app;
}
