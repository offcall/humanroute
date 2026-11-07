# ADR 0022: Order = one payment, many tasks

## Status

Proposed. Amended by ADR 0042 (the draft read reports orphans and settling).

## Context

In v1 one x402 payment created one job (ADRs 0003, 0004). In the v2 demo a firm asks Claude to translate one text into several languages, and the firm signs one payment in Phantom on the pay page (ADR 0027). Each language is a separate task that a different linguist may claim, approve or refund on its own. Signing one payment per language would mean several wallet prompts and several orphan windows for one request.

## Decision

- An order is one x402 payment for N tasks. The `orders` slice owns `orders`, `payments` and `orphans` (ADR 0019).
- `POST /api/orders/draft` (MCP Bearer token of the firm) stores the draft content: text, source language, targets with Claude's drafts. Response `201 {draftId, payUrl, priceUnits, totalUnits, taskCount}`; `payUrl` = `<PUBLIC_BASE_URL>/pay/<draftId>`. No payment is requested here.
- Price is fixed per task from config. `totalUnits = taskCount x priceUnits`, `bigint` base units of `USDC_MINT`.
- `POST /x/orders/:draftId` (x402, no body) requires exactly `totalUnits` to the hold wallet. After a successful settle it returns `201 {orderId, taskIds, payTx}` with `PAYMENT-RESPONSE`.
- The order and its N `open` tasks are created in one SQLite transaction, through the `tasks` index (ADR 0019). Either all tasks exist or none.
- The refund wallet of every task is the firm's login wallet (`firms.wallet`, ADR 0036). The x402 `payer` is still validated as in ADR 0016 and stored on the order.
- Replay and conflicts follow ADR 0004: payment id = SHA-256 of the transaction message; the draft id takes the place of the request fingerprint.
  - Same payment, same draft: the same `201`, no new settle.
  - Same payment, other draft: `409 payment_reused`, nothing created.
  - Draft already paid by another payment: `409 draft_paid`, nothing created.
- A settled payment that cannot become an order is an orphan per ADR 0016 (`502 orphan_payment`, manual operator refund).

## Alternatives

- One payment per task: N wallet prompts and N orphan windows for one request.
- Pay in the MCP server: needs the firm's key on the server (ADR 0027).

## Consequences

- The incoming side has one transaction per order; the outgoing side stays one transaction per task (ADR 0024).
- Unpaid drafts accumulate; they hold no money.
- An unpaid draft stays payable for `DRAFT_TTL_SECONDS` (default 1800).
- v2 starts on a fresh database; `src/jobs`, `src/payments` and the v1 migrations are deleted once `orders` and `tasks` replace them.
