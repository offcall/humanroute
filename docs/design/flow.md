# HumanRoute Flow (v2)

One page: order flow, task and transfer states, failure table. Decisions behind each step are in [`docs/adr/`](../adr/README.md); HTTP shapes in [`api.md`](api.md).

## Order flow

1. **Draft.** Claude Code calls MCP `post_task` with the text, source language and up to 5 target drafts. The gateway stores a draft (30 min TTL, [ADR 0022](../adr/0022-order-one-payment-many-tasks.md)) and returns `payUrl` and an advisory `autopay` snapshot for the draft total. An RPC error or read exceeding 2 s gives `unknown` without failing the draft. Nothing is paid yet.
2. **Pay.** Claude shows `payUrl` and starts `wait_task` immediately, without asking the user to report payment. Only when `autopay` is `available` and the user has not chosen to pay by link, it also asks whether to auto-pay; waiting starts without waiting for an answer. The firm can open the link and sign one x402 payment of `taskCount x TASK_PRICE_USDC` on the pay page (injected Phantom). Or, when instructed to pay, Claude calls MCP `prepare_payment`, which checks the chain again and gets an unsigned payment from the firm's own USDC account (an SPL delegate allowance the firm approved in the cabinet), signs locally with `~/.humanroute/sign.mjs`, and calls `pay_task`. An instruction already given before `post_task` runs this payment before starting a wait; one given during a wait leaves that wait running. `POST /x/orders/:draftId` verifies and settles through the facilitator ([ADR 0036](../adr/0036-agent-autopay-spl-delegate.md)). Neither path starts a second wait for the draft.
3. **Order.** After settlement one SQLite transaction creates the order and one `open` task per target language. Each task snapshots the firm's refund wallet, which is the firm's login wallet ([ADR 0036](../adr/0036-agent-autopay-spl-delegate.md)), not the x402 payer. A payment that settles but cannot be recorded becomes an orphan (`502 orphan_payment`, [ADR 0016](../adr/0016-orphan-payments.md)).
4. **Claim.** A linguist with a matching language pair claims an `open` task inside the claim window. The first claim wins; the claim snapshots the linguist and agency wallets.
5. **Submit.** The linguist edits the draft and submits the result before the work window closes. After that the task is `expired_late`.
6. **Decide.** The firm approves one result or rejects it with a required reason, in the firm cabinet, or through Claude after Claude shows the result and asks the user (MCP `approve_task` / `reject_task`, ADR 0030). Timers expire tasks that were never claimed or never submitted.
7. **Pay out or refund.** Each decided task gets exactly one transfer. A payout is one transaction with three legs: linguist, agency, fee. A refund is one transaction to the firm. Money moves only in `src/payouts/` ([ADR 0024](../adr/0024-split-payout-and-ata.md)).
8. **Read.** Cabinets and MCP `get_task` show the public state. Money shows only when the transfer is `confirmed` ([ADR 0018](../adr/0018-public-job-state-and-payout-progress.md)).

Shares of the price: linguist 80 %, agency 18 %, fee 2 % (config). The linguist gets the rounding remainder. Startup: invalid config exits 1; a failing preflight keeps the server up and answers `503 not_ready` on payments ([ADR 0008](../adr/0008-custody-and-devnet-only.md)).

## Task state machine

```
tasks.state  open ──claim──> claimed ──submit──> submitted ──approve──> approved
               │                 │                    └──reject──> rejected
               │                 └──work window over──> expired_late
               └──claim window over──> expired_unclaimed

public       open, claimed, submitted
             paying_out (approved) -> paid_out      once confirmed
             refunding (rejected or expired) -> refunded   once confirmed
```

## Transfer state machine

One transfer per decided task, unique by `task_id`.

```
transfers.status  pending ──sign, store signature──> sent ──confirmed──> confirmed
                    ^  retryable error or expired blockhash (no memo found)   │
                    └──────────────────────────────────────────────┘          │
                  pending/sent ──final error or attempts exhausted──> failed
                  failed ──npm run requeue -- <transferId|taskId> (ADR 0017)──> pending
```

Memos: `hr:<taskId>` (approved), `hr:<taskId>:rejected`, `:unclaimed`, `:late` (refunds).

## Failure table

| Case | What happens | Where |
| --- | --- | --- |
| Draft body invalid (languages, targets, text size) | `422 invalid_body`, nothing stored | orders |
| Draft unknown or older than 30 min and unpaid | `404`; the firm posts a new draft | orders |
| Pay without a payment header | `402` with `PAYMENT-REQUIRED` | orders |
| Preflight failing (hold SOL or token account, facilitator) | payments `503 not_ready` with reasons; payouts paused, nothing sent | preflight, payouts |
| Same payment sent again for the same draft | same `201` response, no second order | orders |
| Different payment for a paid draft | `409 draft_paid` | orders |
| Payment already used for another draft | `409 payment_reused` | orders |
| Paid on-chain but not recorded | `502 orphan_payment`, orphan row; operator refunds by hand to the owner of the paying token account (ADR 0036) | orders |
| Pay page: network error, 5xx or `409 payment_in_progress` after signing | no Pay button; "Check status" re-reads the draft and only a paid draft changes the page | web |
| Auto-pay: firm wallet has no SOL for the approve or revoke fee | cabinet disables the buttons and links the devnet faucet | web |
| Auto-pay: no allowance, or revoked | `409 autopay_off`; Claude gives the pay link | orders, mcp |
| Auto-pay: allowance below the order total | `409 autopay_limit {leftUnits}`; the firm raises the limit in the cabinet or pays by link | orders, mcp |
| Auto-pay: firm USDC below the order total, or no USDC account | `409 insufficient_usdc {balanceUnits}` or `409 no_usdc_account`; pay link | orders, mcp |
| Auto-pay: signature from another key than the delegate | `pay_task` refuses before sending; the firm enables auto-pay for its agent key | mcp |
| Auto-pay: message is not a HumanRoute payment to the firm's account and HumanRoute | `sign.mjs` refuses to sign | agent machine |
| Auto-pay: blockhash expired or funds moved before `pay_task` | `402` simulation failure; Claude calls `prepare_payment` again | orders, mcp |
| Auto-pay: `pay_task` gets no answer in 45 s, a broken connection or a 5xx other than `orphan_payment` | MCP says the payment may have settled: Claude calls `get_task`; with no order it tells the user the outcome is unknown and asks before paying again | mcp |
| Auto-pay: `409 payment_in_progress` | MCP says the payment is still settling: `get_task` in a few seconds, no new `prepare_payment` | orders, mcp |
| Auto-pay: `502 orphan_payment` | MCP tells Claude the money was taken (`payTx`) without an order and not to pay again; the operator refunds by hand | orders, mcp |
| Second linguist claims the task | `409 claim_taken`; after the claim window `409 claim_closed` | tasks |
| Submit after the work window | `409 late`; the task is refunded as `:late` | tasks, payouts |
| Approve or reject in the wrong state | `409 bad_state` | tasks |
| Reject without a reason | `422 reason_required` | tasks |
| Task never claimed | refund to the firm as `:unclaimed` | payouts |
| Signing fails with a final, non-retryable error | transfer `failed`; log `OPERATOR ACTION REQUIRED` | payouts |
| Broadcast or RPC error, retryable | back to `pending`, attempt + 1, backoff; after 10 attempts `failed` | payouts |
| Signature unseen after its blockhash expired, memo not on chain | back to `pending` and sent again (ADR 0006) | payouts |
| Signature landed under another send (found by memo) | marked `confirmed` | payouts |
| Signature unseen after its blockhash expired, hold memo history not covered back to the transfer's creation | transfer `failed`; log `OPERATOR ACTION REQUIRED`; requeue refuses (ADR 0039) | payouts |
| On-chain error for a sent signature | `failed` | payouts |
| Recipient has no USDC token account | the same transaction creates it (idempotent ATA) | payouts |
| Gateway restarts with a `sent` row | recovered on start by the same rules | payouts |
| Failed transfer after investigation | `npm run requeue -- <id>` refuses unless ADR 0006 allows a resend | payouts |
