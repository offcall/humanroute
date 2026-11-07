# ADR 0044: Devnet E2E on Vitest

## Status

Proposed. Replaces the bash harness named by ADR 0011; builds on ADR 0038.

## Context

Two devnet harnesses existed: the bash `scripts/e2e-devnet.sh` with `scripts/e2e-flow.ts` (ADR 0011) and the Vitest `e2e-devnet` project (ADR 0038). The Vitest run on devnet passed green on 2026-11-07 and makes every check of the bash flow: SIWS sign-in of three roles, order, x402 payment, payout split, `:rejected` and `:unclaimed` refunds with memos and deltas on chain, and the agency and firm ratings.

## Decision

- The devnet e2e is the Vitest `e2e-devnet` project. `npm run e2e:devnet` is an alias of `npm run test:e2e:devnet`.
- The bash harness (`scripts/e2e-devnet.sh`, `scripts/e2e-flow.ts`, `scripts/e2e/`) is removed.
- ADR 0011's rules stay: opt-in, never in `npm run check`, only with the owner's permission for each run, and a missing key, `FEE_WALLET` or agent balance fails the run with a non-zero exit and a message naming what is missing.

## Consequences

- One devnet harness to keep in step with the localnet suite.
- The run needs about 9 USDC and a little SOL on the agent wallet (ADR 0038), not 1.5 USDC.
- `FEE_WALLET` must be set in the environment; the bash script derived it from `keys/fee.json`. A missing key exits 1, not 2.
