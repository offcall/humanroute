# ADR 0014: Self-Facilitation Fallback

## Status

Proposed (deferred)

## Context

Payment verification and settlement depend on the public facilitator `https://x402.org/facilitator`. If it is down or drops devnet support, preflight (ADR 0008) turns `/x/translate` into `503` and no job can be created.

## Decision

- When the x402.org facilitator is unavailable, the gateway verifies and settles the exact SVM payment itself through `@x402/svm`, with the hold wallet (or a dedicated fee payer) co-signing and paying the network fee.
- The switch is explicit config, not automatic failover, so one payment is never settled by two facilitators.
- Payment identity and replay rules (ADR 0004) stay unchanged.

## Alternatives

- Stay on 503 while the facilitator is down (current MVP behavior).
- Another hosted facilitator: another external dependency with unknown devnet support.

## Consequences

- Deferred: time-boxed and not implemented. Until accepted, facilitator outage means 503.
- Self-facilitation makes the gateway pay network fees and needs SOL on the fee payer.
- Whether `@x402/svm` exposes a usable facilitator-side API for this is not verified.
