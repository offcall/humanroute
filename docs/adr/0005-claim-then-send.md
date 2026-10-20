# ADR 0005: Claim Then Send

## Status

Accepted

## Context

The SLA sweep and the expert's answer race for the same job. If either sends money before the decision is durable, a crash or a race can produce a payout and a refund, or a payout with no record.

## Decision

- The decision and the transfer intent are written in one SQLite transaction:
  - `UPDATE jobs SET state = 'released' | 'refunded' WHERE id = ? AND state IN (...) RETURNING ...`; zero rows means another actor won, and nothing else happens.
  - `INSERT INTO transfers (job_id, kind, recipient, amount, status) VALUES (..., 'pending')`, guarded by the unique index on `job_id` (ADR 0003).
- The SLA condition (`deadline` against server time) is part of the same `UPDATE`, so a late answer cannot win against the sweep.
- Nothing touches the network inside the transaction.
- The payouts worker sends only from rows with status `pending`, only after commit, and follows ADR 0006 for signing and resending.
- No module other than `payouts` sends transactions.

## Alternatives

- Send first, record after: a crash between the two loses the record and invites a second send.
- Lock in memory: lost on restart; does not hold across the HTTP handler and the worker.

## Consequences

- At most one decision and one transfer per job, enforced by SQLite.
- Money may lag the decision; the status view shows "payout pending" or "refund pending" until `confirmed`.
- On restart, the worker picks up `pending` and `sent` rows without special recovery code.
