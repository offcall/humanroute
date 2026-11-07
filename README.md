# HumanRoute

**AI agents hire a human expert in one HTTP request.** The agent pays over x402 in USDC on Solana, the job lands on a translator's phone, and each task ends in one on-chain transfer: a split payout or a full refund. First expert type: translation.

Solana devnet · x402 V2 (`exact`, USDC) · Encode Club Solana Hackathon 2026

[Live demo (devnet)](https://humanroute.app.offcall.link) · [Demo videos](#demo) · [Quick start](#quick-start) · [Docs](#docs-and-decisions)

## Demo

<!-- Replace AGENT_VIDEO_UUID and LINGUIST_VIDEO_UUID with the user-attachments ids of the uploaded mp4 files. -->
<table>
<tr>
<th width="62%">An AI agent orders work and auto-pays over x402</th>
<th width="38%">A linguist gets a push on the phone and is paid</th>
</tr>
<tr>
<td><video src="https://github.com/user-attachments/assets/AGENT_VIDEO_UUID" controls width="100%"></video></td>
<td><video src="https://github.com/user-attachments/assets/LINGUIST_VIDEO_UUID" controls width="100%"></video></td>
</tr>
</table>

## Problem

AI agents cannot buy human judgment: there is no HTTP-native way to hire a person and pay for the result without a card, an invoice or a subscription. Firms also need protection from late or bad work; linguists want to be paid per task, on time.

HumanRoute: one HTTP request orders the work, one x402 payment covers the order, the job reaches a linguist's phone, and the money is released only for an approved on-time result. Otherwise it returns to the firm on-chain, automatically.

## How it works

1. **Draft.** Claude Code calls MCP `post_task` with the text and up to 5 target languages. The gateway stores a draft (30 min TTL) and returns a pay link.
2. **Pay.** One x402 payment of `taskCount × 0.50 USDC`, by the agent itself (auto-pay) or by the firm with Phantom.
3. **Order.** After settlement, one SQLite transaction creates the order and one task per language.
4. **Claim and submit.** Linguists with the language pair get a Web Push. The first claim wins; the linguist submits within the work window.
5. **Decide.** The firm approves or rejects, in the cabinet or through Claude, which asks the user first.
6. **Settle.** One on-chain transaction per task: payout split linguist 80 % / agency 18 % / fee 2 %, or full refund.

Roles: the **firm** orders and pays, the **agency** employs linguists and gets its share, the **linguist** does the work and is paid per task. Task states: `open → claimed → submitted → approved | rejected`, plus `expired_unclaimed` and `expired_late` (both refunded).

```
Claude Code ──MCP──> MCP server ──HTTP──> Gateway (Hono + SQLite) ──verify/settle──> x402 facilitator ──> Solana devnet
     │                                       │   ▲                                                        ▲
     └── signs auto-pay locally (sign.mjs)   │   └── Phantom: firm pay page, SIWS login                   │
                                             └── Web Push ──> linguist's phone (PWA)      payouts/refunds ─┘
```

## How Solana and x402 power it

**x402**

- **One payment per order.** `POST /x/orders/:draftId` answers `402` with `PAYMENT-REQUIRED` (x402 V2, `exact`, USDC on devnet, `payTo` the hold wallet). The client retries with `PAYMENT-SIGNATURE`; the x402.org facilitator verifies and settles on Solana.
- **The paid resource is human work.** Settlement creates the order; the agent reads results through MCP `get_task` and `wait_task`.
- **Two payers, one route.** A person pays with Phantom. The agent pays by itself (ADR 0036): the gateway builds the unsigned payment from the firm's USDC account under an SPL delegate allowance, `sign.mjs` signs it locally, and the facilitator pays the network fee (ADR 0040). `sign.mjs` refuses anything but a HumanRoute payment from the firm's account.
- **Payment identity.** The same payment sent again returns the same order; reused for another draft, it gets `409` (ADR 0022).

**Solana**

- USDC (SPL, 6 decimals) for payment, payout and refund; amounts are `bigint` base units end to end.
- One transaction per decided task: a payout with up to three legs, or a refund to the firm's login wallet. Missing token accounts are created in the same transaction (ADR 0024).
- Every transfer carries a memo `hr:<taskId>` (`:rejected`, `:unclaimed`, `:late` for refunds): readable in the explorer and a guard against double sends (ADR 0006).
- Sign-In With Solana (Phantom) is the only login, on desktop and phone (ADR 0020, 0034).
- Auto-pay is a revocable SPL `approve` with a limit; the agent key never holds the firm's funds.
- Cheap, fast finality makes a 0.50 USDC task payable and split three ways.

## Failure and refund handling

Every decided or expired task ends in exactly one transfer; every refund goes to the firm's login wallet. Full table: [`docs/design/flow.md`](docs/design/flow.md#failure-table).

| Case | What happens |
| --- | --- |
| No payment header | `402` with `PAYMENT-REQUIRED` |
| Same payment again, same draft | Same `201`, no second order |
| Second payment for a paid draft, or payment reused for another draft | `409 draft_paid` / `409 payment_reused` |
| Payment still settling | `409 payment_in_progress`; re-read the draft, no new payment |
| Hold wallet or facilitator not ready | `503 not_ready` with reasons; no payment taken, payouts pause |
| Settle refused by verify | `402`, nothing recorded, the draft can be paid again (ADR 0043) |
| Settle outcome unknown (timeout, 5xx, broken connection) | `502 orphan_payment`, row `settle_unknown`; the operator refunds only if the transfer landed (ADR 0043) |
| Paid on-chain but not recorded | `502 orphan_payment`; draft `orphaned`, the agent must not pay again, manual refund (ADR 0016, 0042) |
| Agent unsure whether it paid | Claude checks `get_task` and asks the user before paying again |
| Never claimed, late, or rejected | Full refund, memo `:unclaimed`, `:late` or `:rejected` |
| Payout broadcast fails | Retry from `pending` with backoff, up to 10 attempts; ambiguous errors keep the row `sent`; resend only if the memo is not on chain (ADR 0006, 0039, 0041) |
| Restart with a `sent` row | Recovered on start by the same rules |

Each row of the table is meant to have a test (repo rule). `npm run test:e2e` runs the real gateway, MCP and web app on a local validator; the opt-in devnet e2e checks payment, payout and refunds on chain.

## Quick start

No install: the [live demo](https://humanroute.app.offcall.link) runs on devnet (claim window 30 min, work window 60 min). Switch Phantom to devnet.

Requirements: Node 22.12+, npm. Without a prebuilt `better-sqlite3` binary for your platform, also python3, make and a C++ compiler.

1. `npm ci`
2. `cp .env.example .env` and set `FEE_WALLET` to a devnet address you own (`npx tsx scripts/fee-pubkey.ts` creates `keys/fee.json` and prints one).
3. `npm run setup:wallets`: creates `keys/hold.json` and `keys/agent.json` (mode 0600), airdrops devnet SOL, creates USDC token accounts. Rate-limited airdrop: fund the printed hold address at https://faucet.solana.com and rerun. Firm, agency and linguist wallets are your own Phantom accounts; the firm needs devnet USDC.
4. `npm run build && npm start`: gateway and web app on http://localhost:4021. `GET /health` shows `ready: false` with reasons until the hold wallet and facilitator are ready.
5. Second terminal: `GATEWAY_URL=http://localhost:4021 npm run mcp` (port 4022; this script does not read `.env`).
6. Sign in as a firm with Phantom, open **Connect Claude** and run the shown command on the Claude Code machine:
   `claude mcp add --transport http humanroute http://localhost:4022/mcp --header "Authorization: Bearer <token>"`
   Use only this way: a claude.ai connector cuts the long `wait_task` call (ADR 0031). Do not pre-allow `approve_task` and `reject_task`; the permission prompt is part of the guard (ADR 0030). Auto-pay: [`docs/setup.md`](docs/setup.md#auto-pay).
7. Ask Claude Code: "Translate this text into French and Spanish with HumanRoute." Pay, claim as a linguist on your phone, submit, approve.

**Checks.** `npm run check`: Biome, `tsc`, unit and web tests; offline, no `.env` or keys. `npm run test:e2e`: local validator, no internet; needs `solana-test-validator` (Agave CLI) and `npx playwright install chromium`. Manual local stack: `npm run build && node --import tsx e2e/env/serve.ts`. Devnet e2e: [`docs/setup.md`](docs/setup.md#devnet-e2e).

## Architecture

One Node process, one SQLite file, no second service (ADR 0007). Chain, facilitator, clock and database sit behind small interfaces, so core logic is tested without them.

| Part | Role | Path |
| --- | --- | --- |
| Gateway | Hono API, SQLite, x402 route, SIWS, Web Push, payout worker | `src/` |
| Web app | React + Vite PWA: firm, agency, linguist cabinets, join and pay pages | `web/` |
| MCP server | Streamable HTTP: `post_task`, `get_task`, `wait_task`, `approve_task`, `reject_task`, `prepare_payment`, `pay_task`; HTTP-only client of the gateway | `mcp/` |
| Agent-side signer | `sign.mjs`, `setup.mjs` and their contract tests | `web/public/agent/`, `agent/`, `contracts/` |
| Scripts and e2e | Wallet setup; e2e on a local validator and on devnet | `scripts/`, `e2e/` |
| Spike | First x402 V2 `exact` proof on devnet (2026-10-20) | `spike/` |

Rules: money moves only from `src/payouts/`; decisions only record state and queue a transfer; a send starts only from a `pending` row. Devnet only; the hold wallet is a hot key on the gateway (ADR 0008). Escrow program, mainnet and disputes: [roadmap](docs/roadmap.md).

## Docs and decisions

- [`docs/design/flow.md`](docs/design/flow.md): order flow, state machines, failure table.
- [`docs/design/api.md`](docs/design/api.md): endpoints and shapes.
- [`docs/adr/`](docs/adr/README.md): 44 decisions. Start with 0022 (one payment, many tasks), 0006 (resend), 0024 (split payout), 0031 (`wait_task`), 0036 (auto-pay), 0043 (unknown settle).
- [`docs/setup.md`](docs/setup.md): environment, auto-pay, devnet e2e, Coolify, operator commands.
- [`docs/roadmap.md`](docs/roadmap.md): not built yet.

Module import rules: [ADR 0019](docs/adr/0019-module-layout-v2.md). `keys/` and `.env` are never committed.

## Encode Club Solana Hackathon 2026

Submission to the [Encode Club](https://www.encode.club/) Solana Hackathon 2026, two tracks. Deadline: Monday 9 November 2026, 18:59 GMT+7 (11:59 UTC). Devnet only.

**Best Use of x402 on Solana.** An AI agent pays for a human service over HTTP, with no subscription or checkout. The agent video shows the full flow: `402` request, verification and settlement on Solana, delivery of the order and the human result. Beyond a basic integration: one payment for many tasks, split payouts, automatic refunds, orphan handling, and auto-pay that never gives the agent the firm's funds. Failures: [above](#failure-and-refund-handling).

**Best Consumer App on Solana.** A linguist signs in on the phone by approving in Phantom, with no code to type, gets a push for each task in their language pair, claims, submits, and is paid on-chain once the firm approves. Solana carries the login, the payment and every payout and refund.

- [x] Working demo on devnet: https://humanroute.app.offcall.link
- [x] Repository with README and setup instructions: this file and [`docs/setup.md`](docs/setup.md)
- [ ] 2–4 minute demo video: [Demo](#demo)
- [x] How Solana powers the project: [How Solana and x402 power it](#how-solana-and-x402-power-it)

Status: devnet only; no escrow program yet; orphan payments are refunded by hand. License: Apache-2.0.
