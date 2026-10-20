# ADR 0017: Operator Requeue of Failed Transfers

## Status

Accepted

## Context

ADR 0006 marks a transfer `failed` after a final error or the maximum number of attempts and says an operator must act, but there was no tool. Editing SQLite by hand can reset a row whose transaction already landed or can still land, which pays twice.

## Decision

- A final error sets the transfer to `failed` with `last_error` and logs `OPERATOR ACTION REQUIRED transfer <id> job <jobId>: <error>`.
- `npm run requeue -- <transferId or jobId>` (entry `src/requeue.ts`, logic `src/payouts/requeue.ts`) is the only way out of `failed`.
- Requeue is allowed only when status is `failed` and either:
  - the row has no `tx_sig` (nothing was ever broadcast, ADR 0006 signs and stores before sending), or
  - the chain does not know `tx_sig` (`getSignatureStatuses` with history), and current block height > `last_valid_block_height`, and no memo `hr:<jobId>` is found for the hold wallet.
- Requeue sets status `pending`, keeps `attempts`, clears `last_error`. It never sends; the payouts worker picks the row up under ADR 0006.
- Otherwise it refuses, prints the reason and changes nothing.

## Alternatives

- Automatic retry of final errors: the cause (missing token account, empty hold) needs a human fix first.
- Manual SQL update: skips the double-send guards.

## Consequences

- Same safety rules as the ADR 0006 resend, so a requeue cannot create a second payment.
- The operator fixes the cause (fund hold, create the recipient token account), then requeues.
- A transfer refused because its signature or memo is on-chain needs investigation, not a requeue.
