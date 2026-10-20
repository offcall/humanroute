# HumanRoute Flow

One page: request flow, state machine, failure table. Decisions behind each step are in [`docs/adr/`](../adr/README.md).

## Request flow

1. **Unpaid request.** Agent sends `POST /x/translate {text, sourceLang, targetLang, draft?, meta?}`. Invalid body: `422`, no payment requested. Valid body: `402` with `PAYMENT-REQUIRED` (exact scheme, 0.50 of the `USDC_MINT` token = `500000` base units, `payTo` = hold wallet). The demo uses the devnet test mint `FeyjUFJCsrdmRB7vJQqCtCXTxgKD11DfYqacVDDGRw2c` (ADR 0015). If preflight is failing: `503` with the reasons (ADR 0008).
2. **Pay.** The agent (`@x402/fetch`) retries with `PAYMENT-SIGNATURE`. The gateway computes payment id (hash of transaction message bytes) and request fingerprint (hash of the normalized body) and checks SQLite (ADR 0004).
3. **Settle.** The x402.org facilitator verifies and settles; it pays the network fee. The settle response gives the transaction signature and the payer wallet; `payer` = paying wallet = `transferChecked.authority`, verified on devnet 2026-10-20, see `spike/REPORT.md`. The gateway logs `transaction` and `payer` before parsing anything else. Unparsable header, wrong network, invalid `payer` or a failed job insert: orphan payment, `502 {error: "orphan_payment", payTx}` (ADR 0016).
4. **Job.** One SQLite transaction inserts the job as `paid` (unique by settlement signature) with payment id, fingerprint, payer and SLA deadline. Response: `202 {jobId, statusUrl}` + `PAYMENT-RESPONSE`.
5. **Inbox.** The expert opens the inbox by magic link (demo-only auth) and submits an answer before the deadline: job becomes `answered`.
6. **Decide.** Claim then send (ADR 0005): one transaction sets `released` (answer in time) or `refunded` (SLA expired, found by the sweep) and inserts one `pending` transfer.
7. **Payout or refund.** The payouts worker signs, stores the signature and blockhash expiry as `sent`, broadcasts, and marks `confirmed` at `confirmed` commitment (ADR 0006). Payout: 0.45 USDC to the expert (0.05 stays in hold). Refund: 0.50 USDC to the payer. Memo `hr:<jobId>`.
8. **Status.** `statusUrl` shows the public state `paid | answered | releasing | refunding | released | refunded` and `transfers[]` with `status`, `tx_sig`, `attempts`, `last_error`, explorer link (`?cluster=devnet`). `released`/`refunded` and the answer appear only once the transfer is `confirmed` (ADR 0018).

Startup: invalid config exits 1. A failing preflight does not stop the server: `/x/translate` answers `503` with the reasons and the check re-runs every 60 s (ADR 0008).

Each job has two on-chain money transfers: the incoming payment and one outgoing payout or refund.

## State machine

```
jobs.state       paid ──answer before deadline──> answered ──claim──> released
                   └────────sweep after deadline──────────claim──> refunded

transfers.status pending ──sign+store──> sent ──confirmed──> confirmed
                   ^  retryable error      │ blockhash expired and signature unknown
                   └───────────────────────┘ (memo hr:<jobId> not found)
                 pending/sent ──final error or max attempts──> failed
                 failed ──npm run requeue (safety checks)──> pending

public state     paid, answered (jobs.state)
                 releasing / refunding  decision made, transfer not confirmed
                 released / refunded    transfer confirmed
```

Exactly one transfer row per job (unique `job_id`). Users see "released" or "refunded" only at `confirmed` (ADR 0018).

Requeue (ADR 0017): `npm run requeue -- <transferId or jobId>` moves `failed` back to `pending` only if the row has no `tx_sig`, or the chain does not know `tx_sig`, block height > `last_valid_block_height` and no memo `hr:<jobId>` is found. It keeps `attempts` and clears `last_error`; the worker sends.

## Failure table

| Situation | Behavior |
| --- | --- |
| No payment header | `402` with `PAYMENT-REQUIRED`. Nothing is stored. |
| Invalid request body | `422` before any payment is requested. |
| Underpayment, wrong mint or network | Verification fails, new `402`, no state change. |
| Same `PAYMENT-SIGNATURE` again (before or after payout/refund) | Same `202` with the same `jobId`. No second settlement, payout or refund. |
| Same payment, different body | `409` (fingerprint mismatch). No new job. |
| Facilitator error or timeout at settle | No job is created; the agent gets an error and may retry with the same header. |
| Preflight failed (hold lacks SOL or token ATA, facilitator does not list devnet) | Server keeps running; `/x/translate` answers `503` with the reasons, no payment taken; re-check every 60 s. |
| Settled, but header unparsable, wrong network, invalid `payer` or job insert failed | Orphan: `transaction` and `payer` logged first, row in `orphan_payments`, `502 {error: "orphan_payment", payTx}`. Operator refunds by hand (ADR 0016). |
| Expert silent past the SLA | Sweep claims `refunded`; refund to the payer with memo. |
| Expert answers after the deadline | `409`; job stays `refunded`. |
| Crash after claim, before send | `pending` row is picked up on restart and sent once. |
| Crash after broadcast | Stored signature is checked; a new transaction only after blockhash expiry and no memo match. |
| Retryable RPC error (429, timeout, `BlockhashNotFound`) | Back to `pending`, bounded attempts with backoff. |
| Final error (recipient token account missing, insufficient funds) | Transfer `failed` with `last_error`, log `OPERATOR ACTION REQUIRED`; operator fixes the cause and runs `npm run requeue` (ADR 0017). |
| Payer missing or invalid in settle response | Orphan payment (ADR 0016). `payer` extraction verified on devnet 2026-10-20, see `spike/REPORT.md`. |

Timings: "released"/"refunded" mean `confirmed` commitment, not `finalized`. Measured on devnet with the test mint on 2026-10-20 (`spike/REPORT.md`): facilitator settle ~1.0 s, payment at `confirmed` ~0.2 s after settle, refund send to `confirmed` ~0.8 s. No fixed latency is promised.
