# ADR 0043: A Settle That May Have Broadcast Is an Unknown Outcome

## Status

Proposed. Amends ADR 0016 (a new orphan reason), ADR 0022 and ADR 0042 (the pay route refuses an orphaned draft); their other decisions stay.

## Context

The x402 middleware (`@x402/hono` 2.28.0) answers `402` for every settle failure: a `success: false` settle response, a `SettleError`, and any other exception (connection reset, 429 or 5xx text from the facilitator). A `FacilitatorResponseError` (timeout, invalid JSON or data on a 2xx) answers `502 {error}`. The gateway passed all of them through and recorded nothing.

Not all of them mean "not paid". In `@x402/svm` 2.28.0 the facilitator's settle verifies, signs, sends, then confirms. `settlement_pending` is returned after the send when confirmation failed, with the broadcast signature in `transaction`; `@x402/core` retries it once and then gives up. `invalid_exact_svm_transaction_failed` follows a send attempt (send error, on-chain failure, or a pending result that could not be stored). `duplicate_settlement` means an earlier settle of the same transaction is in progress or done. A transport error or timeout leaves the facilitator's progress unknown.

The devnet run of 2026-11-07 had seven `settlement_pending` failures (the facilitator's RPC answered 429 while confirming). The payments landed on chain; the gateway answered `402 {}`, the pay page offered Pay again and MCP said the payment failed.

## Decision

- A settle attempt starts when the pay handler runs: verify passed and the middleware calls settle next.
- After a settle attempt, an answer that is not a `2xx` with `PAYMENT-RESPONSE` is a refusal only when `PAYMENT-RESPONSE` decodes to `success: false`, names no `transaction`, and its `errorReason` starts with `invalid_` and is not `invalid_exact_svm_transaction_failed`. These are the facilitator's own verify refusals before signing and sending (payload, amount, recipient, simulation). A refusal passes through as `402`, nothing is recorded, and the draft can be paid again.
- Every other outcome may have settled: `settlement_pending`, `invalid_exact_svm_transaction_failed`, `duplicate_settlement`, any other reason, a thrown error (transport, 429, 5xx), a timeout, an invalid facilitator answer, or a `2xx` without `PAYMENT-RESPONSE`.
- Such an outcome is an orphan per ADR 0016 with reason `settle_unknown`: the row stores the draft id (ADR 0042), the signature, payer and network when the settle response names them, and the raw `PAYMENT-RESPONSE` or an empty string. The answer is the existing `502 {error: "orphan_payment", payTx}` (`payTx` null when unknown), without `PAYMENT-RESPONSE`. No chain read on the request path.
- Migration `0003` of the `orders` slice rebuilds `orphans` so its `reason` check allows `settle_unknown`.
- The draft gate answers `502 orphan_payment` with the first orphan's `payTx` for a draft that has an orphan row, resolved or not, for any request, before verify. An order for the draft still wins (`201` replay or `409 draft_paid`). A retry of the same payment header therefore never reaches the facilitator again, and a new payment for that draft is never taken.
- The in-flight lock is unchanged: it is held during settle and released after the orphan row is written, so the draft read goes from `settling` to `orphaned` without a `draft` in between.
- The operator checks the transaction on chain and resolves the orphan by hand: refund, or nothing to refund when the transaction failed or never landed. An orphaned draft is not reopened; the firm creates a new draft.

## Alternatives

- Read the chain for the signature before answering: adds RPC calls and their failures to the request path, and a pending signature may still land later.
- Retry the same header against the facilitator: the facilitator may reconcile, but a re-verify of a landed transaction fails simulation and answers a misleading `402`.
- A distinct code (`502 settle_unknown`): both clients already treat `orphan_payment` as "do not pay again"; a new code would need client changes for the same behavior.
- Allow-list exact verify reasons: `@x402/svm` does not export them and the facilitator may be another implementation; the `invalid_` prefix with one exception is the smaller rule and fails closed for unknown reasons.

## Consequences

- A refused-before-send settle still answers `402` and stays payable.
- Some unknown outcomes did not settle (send refused, transaction failed on chain); they become orphans the operator resolves without a refund. The clients' text "settled but not recorded" overstates this; the payment may have settled.
- A firm whose draft became an orphan cannot pay that draft again, even after the operator resolves it.
