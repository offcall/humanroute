# ADR 0006: Sign Before Send and Resend Policy

## Status

Accepted. Amended by ADR 0039 (memo history window) and ADR 0041 (unknown send errors are ambiguous).

## Context

A unique transfer row (ADR 0005) prevents two decisions, not two transactions. If the process crashes after broadcasting but before recording the signature, or resends on a timer while the first transaction can still land, the job is paid twice. A Solana transaction can land until its blockhash expires (`lastValidBlockHeight`).

## Decision

- Sign first: build and sign the transaction, store `signature`, `recent_blockhash`, `last_valid_block_height` and status `sent` in one write, then broadcast.
- The memo is `hr:<jobId>` on every outgoing transfer.
- Rebroadcast of the same signed bytes is always safe. A new transaction (new blockhash) is built only when both hold:
  - `getSignatureStatuses([sig], { searchTransactionHistory: true })` knows nothing about the stored signature, and
  - current block height > stored `last_valid_block_height`.
- Second guard before a new transaction: scan `getSignaturesForAddress(hold)` for memo `hr:<jobId>`; a match is recorded as the transfer's signature instead of sending.
- `sent -> confirmed` when the signature reaches `confirmed` commitment (ADR 0008).
- Retryable errors (HTTP 429, timeouts, `BlockhashNotFound`): back to `pending` with `attempts + 1` and exponential backoff; after a fixed maximum the row becomes `failed`.
- Final errors (recipient token account missing, insufficient USDC or SOL): status `failed` with `last_error`; an operator must act. No automatic retry.

## Alternatives

- Resend after a fixed timer (old code, 120 s): the first transaction may still land.
- Memo lookup only: RPC indexing lag can miss a landed transaction.

## Consequences

- A crash at any point leaves either no signature (safe to sign again) or a stored signature that is checked before any new send.
- `failed` rows need operator attention; the status view shows them. Note: the operator tool is ADR 0017 (requeue).
- Changing these rules needs a new ADR.
