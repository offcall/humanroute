# ADR 0018: Public Job State and Payout Progress

## Status

Superseded by ADR 0023.

## Context

ADR 0003 separates the decision (`jobs.state`) from money movement (`transfers.status`) and says users see "paid out" or "refunded" only at `confirmed`. The status JSON and HTML showed `released`/`refunded` right after the decision, while the transfer could still be `pending` or `failed`.

## Decision

- The status JSON and HTML show a public state derived from both tables: `paid | answered | releasing | refunding | released | refunded`.
- `paid` and `answered` come from `jobs.state`.
- `releasing` / `refunding`: the decision is made and the transfer is not `confirmed` (`pending`, `sent` or `failed`).
- `released` / `refunded`: only when the transfer is `confirmed` (ADR 0003, ADR 0008).
- `transfers[]` in the status JSON carries `kind`, `status`, `tx_sig`, `attempts`, `last_error`, `explorer_url`.
- The answer is shown only once the release transfer is `confirmed`.
- `jobs.state` in SQLite is unchanged; the public state is computed, not stored.

## Alternatives

- Store the public state as a column: duplicates `transfers.status` and can drift.
- Show both raw values only: users must combine two fields to know if money moved.

## Consequences

- A `failed` transfer shows as `releasing`/`refunding` with `status: failed` and `last_error`, so a stuck payout is visible.
- Clients that wait for `released`/`refunded` now wait for confirmed money, not for the decision.
