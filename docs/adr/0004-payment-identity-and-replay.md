# ADR 0004: Payment Identity and Replay

## Status

Accepted

## Context

An agent may resend the same `PAYMENT-SIGNATURE` header (network retry, crash, malice). Hashing the whole header is unreliable: serialization can differ, and the facilitator fee-payer signature slot is empty in the client copy. The same payment must never create a second job, a second settlement or a second payout, and must not be reused for a different request body.

## Decision

- A job exists only after the facilitator settlement succeeds. It is unique by the settlement transaction signature (`SettleResponse.transaction`).
- Payment id = SHA-256 of the transaction message bytes decoded from `PAYMENT-SIGNATURE` (signatures excluded).
- Request fingerprint = SHA-256 of the normalized request body (validated fields, fixed key order).
- Both are stored in SQLite with unique indexes, together with the job id.
- Same payment id with the same fingerprint returns the same `202 {jobId, statusUrl}` without calling the facilitator again.
- Same payment id with a different fingerprint returns `409` and creates nothing.
- The body is validated before any payment is requested (`422` without a 402).

## Alternatives

- Hash of the raw header: breaks on harmless re-encoding.
- Rely on the facilitator duplicate cache (120 s): too short and not under our control.
- Client-supplied idempotency key: not part of x402; agents would have to opt in.

## Consequences

- Payment decoding uses the Solana SDK, not a hand-written compact-u16 parser.
- Replay protection survives restarts because it lives in SQLite.
- A crash between settlement and the job insert can still leave a settled payment without a job; recovery for that window is not covered by this ADR. Note: closed by ADR 0016 (orphan payments).
