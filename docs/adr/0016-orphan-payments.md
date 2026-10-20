# ADR 0016: Orphan Payments

## Status

Accepted

## Context

ADR 0004 left a window open: the facilitator settles a payment, but no job is created. This happens when the `PAYMENT-RESPONSE` settle header cannot be parsed, names another network, carries an invalid `payer`, or `recordPaid` fails. The money is in the hold wallet, and a replay of the same header is rejected by the facilitator (`spike/REPORT.md`), so the agent paid and got nothing, and nothing recorded it.

## Decision

- An orphan payment is a settled payment without a job.
- On settle, the gateway logs the settlement `transaction` and `payer` (as raw strings, when present) before parsing anything else in the response.
- `payer` is validated as a base58 32-byte public key; a failure makes the payment an orphan.
- Each orphan is stored in table `orphan_payments`: `pay_tx` (UNIQUE), `payer` (nullable), `network`, `raw_header`, `reason`, `created_at`, `resolved_at` (nullable).
- The agent gets `502 {error: "orphan_payment", payTx}`.
- Refunding an orphan is a manual operator action. The gateway never refunds orphans automatically.
- An operator finds open orphans with SQL: `SELECT * FROM orphan_payments WHERE resolved_at IS NULL;`, refunds by hand after checking the transaction on-chain, then sets `resolved_at`.

## Alternatives

- Automatic refund: needs a trusted payer, which is exactly what may be missing or invalid.
- Log only: lost on log rotation; no query for open cases.

## Consequences

- Every settled payment ends as a job or an orphan row, except a process crash between settle and insert (only the log line may remain).
- Orphan refunds are outgoing transfers outside `src/payouts/` rules; they are done by the operator, not by the gateway.
- Open orphans are a liability the operator must clear; `resolved_at` records that.
