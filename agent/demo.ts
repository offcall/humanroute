// Demo agent: "translates" a 3-sentence contract with a fake MT, escalates the least confident sentence.
// npx tsx agent/demo.ts [--silent]
import { GATEWAY_URL, escalateToHuman, explorerTx, pollStatus, type JobStatus } from './escalate.js';

const silent = process.argv.includes('--silent');

const contract = [
  {
    id: 'c1',
    text: 'This Agreement is entered into on the date of the last signature below.',
    draft: 'Dieser Vertrag wird am Datum der letzten Unterschrift unten geschlossen.',
    confidence: 0.94,
  },
  {
    id: 'c2',
    text: 'The Supplier shall indemnify the Client against all claims arising from latent defects.',
    draft: 'Der Lieferant soll den Kunden gegen alle Ansprüche aus versteckten Mängeln entschädigen.',
    confidence: 0.58,
  },
  {
    id: 'c3',
    text: 'This Agreement is governed by the laws of Germany.',
    draft: 'Dieser Vertrag unterliegt dem Recht der Bundesrepublik Deutschland.',
    confidence: 0.97,
  },
];

const inboxToken = process.env.INBOX_TOKEN || 'dev-inbox-token';
const elapsed = (t0: number) => `${((Date.now() - t0) / 1000).toFixed(0)}s`;

async function main() {
  console.log(`gateway: ${GATEWAY_URL}${silent ? '  (silent mode: expert will not answer)' : ''}\n`);
  for (const s of contract) console.log(`[${s.id}] conf=${s.confidence.toFixed(2)}  ${s.draft}`);

  const worst = contract.reduce((a, b) => (b.confidence < a.confidence ? b : a));
  console.log(`\nescalating ${worst.id} (conf ${worst.confidence}) to a human via x402...`);

  const esc = await escalateToHuman({
    text: worst.text,
    sourceLang: 'en',
    targetLang: 'de',
    draft: worst.draft,
    meta: { clauseId: worst.id, confidence: worst.confidence },
  });
  console.log(`paid. jobId=${esc.jobId} payer=${esc.payer ?? '?'}`);
  if (esc.payTx) console.log(`payment tx: ${explorerTx(esc.payTx)}`);
  console.log(`status:     ${esc.statusUrl}`);
  console.log(`status UI:  ${esc.statusUrl.replace(/\/jobs\/([^/?]+)\?/, '/jobs/$1/view?')}`);
  if (silent) console.log(`inbox:      ${GATEWAY_URL}/inbox/${inboxToken}\nwaiting for SLA refund...`);
  else console.log(`expert inbox: ${GATEWAY_URL}/inbox/${inboxToken}\nwaiting for the expert...`);

  const t0 = Date.now();
  let last = '';
  const final: JobStatus = await pollStatus(esc.statusUrl, {
    onTick: (s) => {
      const line = `${s.state}${s.viewed_at ? ' (viewed)' : ''} transfers=${s.transfers.map((t) => `${t.kind}:${t.status}`).join(',') || '-'}`;
      if (line !== last) console.log(`  +${elapsed(t0)} ${line}`);
      last = line;
    },
  });

  console.log(`\nfinal state: ${final.state}`);
  if (final.answer) {
    console.log(`human answer: ${final.answer}`);
    worst.draft = final.answer;
  }
  if (final.refund_reason) console.log(`refund reason: ${final.refund_reason}`);
  for (const t of final.transfers) {
    const link = t.explorer_url ?? (t.tx_sig ? explorerTx(t.tx_sig) : '(no tx yet)');
    console.log(`  ${t.kind} [${t.status}] ${link}`);
  }
  if (esc.payTx) console.log(`  payment [confirmed] ${explorerTx(esc.payTx)}`);

  console.log('\nfinal translation:');
  for (const s of contract) console.log(`  ${s.draft}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
