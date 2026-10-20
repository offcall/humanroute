# ADR 0011: Devnet E2E Outside Check

## Status

Accepted

## Context

The real proof of HumanRoute is a paid request, a settlement and a payout or refund on Solana devnet. Devnet is slow, rate-limited and needs funded keys, so it cannot be part of the commit gate. The old `scripts/e2e.sh` exited 0 when keys were missing, which looked like success.

## Decision

- `npm run e2e:devnet` is an opt-in command that runs the real flow against devnet and the x402.org facilitator.
- Without keys or funds it fails with a non-zero exit and a clear message naming what is missing. It never skips silently.
- It runs only with explicit owner approval, never from `npm run check`.
- Unit tests, when they exist, never touch the network: chain, facilitator and clock are faked through the interfaces in ADR 0009.
- Tests are deferred for now by owner decision; this pass ships no test files.

## Alternatives

- Devnet in `npm run check`: flaky, slow, spends faucet funds.
- Local validator: no x402.org facilitator there.

## Consequences

- `npm run check` stays fast and deterministic.
- Behavior is only verified end to end when someone runs `e2e:devnet` on purpose; README records measured timings from those runs.
- Adding tests later needs no architecture change.
