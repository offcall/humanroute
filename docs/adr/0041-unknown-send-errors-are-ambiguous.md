# ADR 0041: Unknown Send Errors Are Ambiguous

## Status

Proposed

## Context

ADR 0006 lists "timeouts" among retryable errors. A timeout after the broadcast started may still have reached a leader; treating it as retryable would send a new transaction while the first can land. The code is stricter: `classify` (`src/chain/errors.ts:23`) treats any unknown error in the send phase as ambiguous (`src/chain/errors.ts:34`), and `sendPending` leaves such a row `sent` (`src/payouts/send.ts:82`-`:91`).

## Decision

The code's rule is the policy:

- Prepare phase (blockhash, status, height, memo reads; nothing broadcast): an unknown error, including a timeout, is retryable.
- Send phase (`sendRawTransaction`): HTTP 429, "too many requests" and `BlockhashNotFound` are retryable (rejected before forwarding); the final patterns and "simulation failed" are final; anything else, including timeouts, connection resets and 5xx, is ambiguous.
- Ambiguous: the row stays `sent`, no attempt is counted, and it is resolved only by signature status, blockhash expiry and the memo guard (ADR 0006, ADR 0039).
- The "timeouts" in ADR 0006's retryable list means prepare-phase timeouts only.

## Consequences

- No code change.
- Test CH-06 asserts: a timeout or connection error is `ambiguous` in `Phase.Send` and `retryable` in `Phase.Prepare`; after an ambiguous broadcast the row is still `sent` with the same `tx_sig` and `attempts`, and nothing is signed again before the ADR 0006 guard allows it.
