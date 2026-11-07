# ADR 0039: Resend Guard History Window

## Status

Proposed

## Context

ADR 0006 sends a new transaction only when the old signature is unknown, its blockhash expired, and no hold transaction carries the memo `hr:<id>`. ADR 0017 requeue uses the same check (`checkExpiry` in `src/payouts/recover.ts:9`, called from `src/payouts/requeue.ts:33`).

`findMemo` (`src/chain/status.ts:51`) reads one page of the last 200 signatures of the hold wallet (`src/chain/status.ts:7`, `:57`). Once more than 200 hold transactions are newer than a landed payout, the memo is not found, the row goes back to `pending`, and the task is paid twice.

The memo must be found for every attempt of the row, not only the latest one: going back to `pending` and requeue clear `tx_sig` (`src/payouts/sql.ts:35`, `:38`), so earlier signatures are no longer stored. No signing slot is stored; `created_at` is the earliest time any transaction of the row can have been signed.

## Decision

- `SolanaClient.findMemo(memo, since)` takes `since` = the transfer's `created_at` (ms, gateway clock) and returns `found` with the signature, `absent`, or `uncovered`.
- It pages `getSignaturesForAddress(hold, { limit: 1000, before })` at `confirmed`, newest first, `before` = the last signature of the previous page, at most 10 pages (10,000 signatures).
- A successful entry whose memo contains `memo` on any scanned page is `found`.
- The window is covered when a scanned entry has a non-null `blockTime` < `since / 1000 - 600` (10 minutes of margin for clock skew between the gateway and block times). Entries with a null `blockTime` are searched but never prove coverage.
- `absent` only when the window is covered and nothing matched. A short or empty page before coverage, or 10 pages without coverage, is `uncovered`: the hold wallet's SOL funding is older than every transfer, so a full-history RPC always reaches coverage, and not reaching it means the history seen is incomplete.
- An RPC error on any page stays an error (`unavailable`, no decision), as today.
- `checkExpiry` returns a new state `uncovered`. Payouts worker (`checkSent`): `uncovered` marks the row `failed` with `memo history of the hold wallet not covered back to <created_at>` and logs `OPERATOR ACTION REQUIRED`; it never goes back to `pending`. Requeue (ADR 0017): `uncovered` refuses with the same reason and changes nothing.
- The other ADR 0006 and ADR 0017 conditions are unchanged.

## Alternatives

- Store the signing slot and page back to it by slot: no clock skew, but needs a schema change and covers only the latest attempt, because earlier signatures are cleared.
- Unbounded paging: one busy or broken RPC can stall the worker indefinitely.
- Treat the end of the RPC history as covered: a pruned RPC would allow a double payment.

## Consequences

- Code: `src/chain/status.ts` (or a new `src/chain/memo.ts` if it passes ~100 lines), `src/chain/types.ts`, `src/chain/client.ts`, `src/payouts/types.ts` (`Sendable.createdAt`, `Expiry` state `uncovered`), `src/payouts/recover.ts`, `src/payouts/requeue.ts`, `src/testing/chain.ts`. About 60 lines.
- Test NEW-03 asserts: a successful memo on the second page (first page 1,000 newer unrelated signatures) is found, `checkSent` confirms through it and nothing is signed or broadcast; an uncovered history (10 full pages newer than `since`, a short page before coverage, or only null `blockTime` entries) never calls `signPayout` or `broadcast`, fails the row in the worker, and is refused by requeue.
- A row that is `failed` because the history is uncovered has no automatic exit: the operator checks the hold wallet by hand. A manual override needs a new ADR.
- Each resend decision costs up to 10 RPC calls; it only runs for expired, unknown signatures.
