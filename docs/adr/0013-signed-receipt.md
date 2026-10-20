# ADR 0013: Signed Receipt

## Status

Proposed (deferred)

## Context

An agent may want proof of what the gateway did for its payment, beyond the HTTP status view. On-chain memos link outgoing transfers to a job but do not carry the result or the decision.

## Decision

- The status view includes an Ed25519 receipt signed by the gateway key over the canonical JSON `{jobId, payTx, releaseOrRefundTx, resultHash}`.
- `resultHash` is SHA-256 of the answer text; `releaseOrRefundTx` is the confirmed transfer signature (ADR 0006).
- The receipt is issued only after the transfer is `confirmed`.
- The gateway public key is published in README and `/` so receipts can be checked offline.

## Alternatives

- No receipt: explorer links and memos only (current MVP).
- On-chain attestation: costs a transaction per job and needs a program.

## Consequences

- Deferred for scope. A receipt proves what the gateway claims, not translation quality or SLA compliance.
- Adds a gateway signing key separate from the hold keypair.
