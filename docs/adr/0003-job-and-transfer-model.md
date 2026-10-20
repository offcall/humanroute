# ADR 0003: Job and Transfer Model

## Status

Accepted

## Context

In the previous design `released`/`refunded` meant both "decided" and "money sent", so a crash after the decision showed a payout that never happened. A unique `transfers` row stops two decisions but must also stop two payouts. Amounts were stored as JS `number`.

## Decision

- `jobs.state`: `paid -> answered -> released` or `paid -> refunded` (SLA expired). The state is the decision only. Deferred QA (ADR 0012) would add `answered -> refunded` through a new ADR.
- `transfers.status`: `pending -> sent -> confirmed`, or `failed` (ADR 0006). This is the money movement, separate from the decision.
- Exactly one transfer per job: unique index on `transfers.job_id`. It is either a payout to the expert or a refund to the payer, never both.
- A job is shown as "paid out" or "refunded" to users only when its transfer is `confirmed`.
- Money is `bigint` base units in code (USDC: 6 decimals; 0.50 USDC = `500000n`). SQLite stores amounts as TEXT or INTEGER, never REAL. No `number` for amounts anywhere.
- Each job has exactly two on-chain money transfers: the incoming payment (settled by the facilitator) and one outgoing transfer.

## Alternatives

- One combined state column: simpler, but it hides "refund pending" and is how the old code went wrong.
- Several transfer rows per job with retries as new rows: makes double payment possible by design.

## Consequences

- Status views read both tables: decision from `jobs`, progress from `transfers`. Note: the public states are defined in ADR 0018.
- A second payout is blocked by the database, not by worker logic.
- Amount parsing and formatting need bigint helpers.
