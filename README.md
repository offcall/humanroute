# HumanRoute

A firm orders human translation from an AI agent. Claude Code (over MCP) drafts the texts and posts one order; the firm pays once over x402 in USDC on Solana devnet. Linguists claim the tasks, the firm approves or rejects each result, and every task is settled on-chain: one payout transaction splits the price between the linguist, the agency and the fee, or the firm gets a full refund.

Hackathon demo for Encode "Best Use of x402 on Solana". Devnet only. Tests are deferred by the owner; the gate is `npm run check`.

Live demo (devnet): https://humanroute.app.offcall.link

## How x402 is used

- **One payment per order.** `POST /x/orders/:draftId` answers `402` with `PAYMENT-REQUIRED`: x402 V2, scheme `exact`, price `taskCount x TASK_PRICE_USDC`, `payTo` the hold wallet. The firm signs one USDC transfer; the x402.org facilitator verifies and settles it on Solana, and pays the network fee.
- **The paid resource is the work.** Settlement creates the order and one task per language. The agent then reads the human results through MCP (`get_task`, `wait_task`), and the money for each task is released or refunded on-chain.
- **Two payers, one route.** A person pays on the pay page with Phantom. The agent pays by itself (auto-pay, ADR 0036): the gateway builds the unsigned x402 payment from the firm's own USDC account under an SPL delegate allowance, and Claude signs it locally. Both go through the same verify and settle.
- **Payment identity.** One payment pays one draft: the same payment sent again returns the same order, and a payment reused for another draft gets `409` (ADR 0004).

## How Solana powers it

- USDC (SPL, 6 decimals) is the money for payment, payout and refund; amounts are `bigint` base units end to end.
- Sign-In With Solana (Phantom) is the only login for firms, agencies and linguists, on desktop and on the phone (ADR 0020, ADR 0034).
- Each decided task is one on-chain transaction: a payout with three legs (linguist, agency, fee) or a refund to the firm. Every transfer carries a memo `hr:<taskId>` (`:rejected`, `:unclaimed`, `:late` for refunds), so the explorer shows what each payment was for (ADR 0024).
- Auto-pay is an SPL `approve` with a limit, signed by the firm in Phantom and revocable; the agent key never holds the firm's funds (ADR 0036).

## Failed payments

The full failure table is in [`docs/design/flow.md`](docs/design/flow.md#failure-table). The main payment cases:

| Case | What happens |
| --- | --- |
| No payment header | `402` with `PAYMENT-REQUIRED` |
| Same payment sent again for the same draft | Same `201` answer, no second order |
| Another payment for a paid draft, or a payment reused for another draft | `409 draft_paid` / `409 payment_reused` |
| Hold wallet or facilitator not ready | `503 not_ready` with reasons; payouts pause, nothing is sent |
| Paid on-chain but not recorded | `502 orphan_payment`; the agent is told not to pay again |
| Agent payment outcome unknown (timeout, broken connection) | Claude checks `get_task` and asks the user before any new payment |
| Task never claimed, submitted late, or rejected | Full refund to the firm, memo `:unclaimed`, `:late` or `:rejected` |
| Payout broadcast fails | Retried from `pending` with backoff; resend only when the memo is not on chain (ADR 0006) |

## Parts

| Part | What | Where |
| --- | --- | --- |
| Gateway | Node process: Hono HTTP API, SQLite, x402 payment route, payout worker | `src/` |
| Web app | React + Vite, PWA manifest, Indigo UI (ADR 0032): landing, firm (jobs, review, task detail), agency, linguist (board, my tasks, wallet), join, approve and pay pages; sign-in from Safari or the home-screen icon via approve in Phantom (ADR 0034); Web Push for new tasks (ADR 0029) | `web/` |
| MCP server | Remote MCP over Streamable HTTP, tools `post_task`, `get_task`, `wait_task` (waits for the next change) and `approve_task` and `reject_task` (Claude asks the user before deciding), `prepare_payment` and `pay_task` (auto-pay: Claude signs the order payment locally with the firm's agent key, ADR 0036); talks to the gateway over HTTP only | `mcp/` |
| Scripts | Devnet wallet setup and an opt-in e2e flow | `scripts/` |
| Spike | First proof of x402 V2 `exact` on devnet (2026-10-20): payment, settle, replay, refund. Throwaway code kept with its report and raw fixtures | `spike/` |

Money moves only from `src/payouts/`. Decisions (approve, reject, timers) only record state and queue a transfer.

## Docs

Design: [`docs/design/flow.md`](docs/design/flow.md). Endpoints and shapes: [`docs/design/api.md`](docs/design/api.md). Decisions: [`docs/adr/`](docs/adr/README.md). Not built yet: [`docs/roadmap.md`](docs/roadmap.md).

## Run locally

Requirements: Node 22.12 or newer, npm.

1. `npm ci`
2. `cp .env.example .env`, then set `FEE_WALLET` (any devnet address you own).
3. Wallets: `npm run setup:wallets` creates `keys/hold.json` and `keys/agent.json` (mode 0600), airdrops devnet SOL and creates token accounts. The firm, agency and linguist wallets are Phantom accounts you prepare yourself; the firm needs devnet USDC.
4. `npm run build`: builds the web app into `web/dist`. The gateway serves it.
5. `npm start`: gateway on `PORT` (default 4021). The SQLite file at `DB_PATH` is created on first start.
6. `npm run mcp`: MCP server on `MCP_PORT` (default 4022), needs `GATEWAY_URL`. Firm cabinet shows the MCP URL and token; add them to Claude Code:
   `claude mcp add --transport http humanroute <MCP_PUBLIC_URL> --header "Authorization: Bearer <token>"`
   Connect only this way; a claude.ai connector is not supported, because its proxy cuts the long `wait_task` call (ADR 0031).
   Do not pre-allow `approve_task` and `reject_task` in Claude Code permissions: they pay out or refund, and the permission prompt is part of the guard (ADR 0030).
   Auto-pay (optional, ADR 0036): in the cabinet's Connect Claude panel, run the shown command on the Claude Code machine. It downloads `sign.mjs` and `setup.mjs` from the gateway and creates `~/.humanroute/agent-key.json` (mode 0600). Then enable auto-pay with a limit (the firm wallet needs a little devnet SOL for the fee, from faucet.solana.com): Phantom (on devnet) signs an SPL approve that lets the agent key spend up to the limit from the firm's own USDC account. Claude offers auto-pay only when the draft's chain snapshot says the delegate, allowance and balance cover its total; it does not check the local key. Unless already instructed to pay, Claude shows the link and immediately waits for payment, including while an auto-pay question is pending: no "paid" message from the user is needed. When instructed, it signs locally with `sign.mjs` and pays through `prepare_payment` and `pay_task`, which check availability again. One wait runs per draft. An unknown payment outcome is checked before any further payment; an orphan must not be paid again. Refunds always go to the firm's login wallet.
7. Frontend development: `npm run web:dev` (proxies `/api`, `/x`, `/health` to the gateway on port 4021).

Checks: `npm run check` runs Biome, the gateway `tsc`, the web `tsc` and the service worker `tsc`. `npm run e2e:devnet` (opt-in, real devnet, needs `keys/hold.json`, `keys/agent.json` and about 1.5 USDC on the agent wallet) starts the gateway with a fresh database and runs `scripts/e2e-flow.ts`: SIWS sign-in, order, payment, payout and refunds, checked on chain. Not part of `check` ([ADR 0011](docs/adr/0011-devnet-e2e-outside-check.md)).

A database from v1 is refused (ADR 0022). Use a fresh `DB_PATH`.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `RPC_URL` | devnet RPC | Solana JSON-RPC |
| `SOLANA_NETWORK` | devnet CAIP-2 id | x402 network |
| `FACILITATOR_URL` | x402.org facilitator | verifies and settles payments |
| `USDC_MINT` | devnet USDC | payment and payout mint |
| `HOLD_KEYPAIR_PATH` | `keys/hold.json` | hold wallet: receives payments, sends payouts and refunds (mode 0600) |
| `AGENT_KEYPAIR_PATH` | `keys/agent.json` | agent wallet, firm and payer in `scripts/e2e-flow.ts` |
| `PORT`, `DB_PATH`, `COMMITMENT` | 4021, `data/humanroute.db`, `confirmed` | server, SQLite file, commitment |
| `TASK_PRICE_USDC` | `0.50` | price of one task |
| `TIMER_MODE` | `video` | `video` (claim 60 s, work 180 s) or `public` (claim 30 min, work 60 min) |
| `CLAIM_WINDOW_SECONDS`, `WORK_WINDOW_SECONDS` | empty | override the preset |
| `LINGUIST_SHARE_BPS`, `AGENCY_SHARE_BPS`, `FEE_SHARE_BPS` | 8000, 1800, 200 | payout split, must sum to 10000 |
| `FEE_WALLET` | required | address of the fee leg |
| `PUBLIC_BASE_URL` | required | base of invite and pay links, SIWS domain |
| `MCP_PUBLIC_URL` | required | MCP URL shown to firms |
| `DRAFT_TTL_SECONDS`, `SESSION_TTL_SECONDS`, `NONCE_TTL_SECONDS` | 1800, 604800, 300 | lifetimes |
| `WEB_DIST_DIR` | `web/dist` | built web app |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | empty | Web Push for new tasks (ADR 0029); all three or none, none = push off; the subject must be a real `mailto:` or `https:` (Apple rejects placeholder domains); keys from `npx web-push generate-vapid-keys` |
| `GATEWAY_URL`, `MCP_PORT` | required, 4022 | MCP process only |

Startup: invalid configuration exits 1. A failing preflight (hold without SOL or token account, facilitator without devnet) keeps the server up: `/health` shows `ready: false`, payments answer `503 not_ready` with the reasons, and payouts pause.

## Deploy on Coolify

- **Gateway app** (Nixpacks, Node 22; `NIXPACKS_NODE_VERSION=22`, `NIXPACKS_APT_PKGS=python3` for better-sqlite3). Nixpacks runs `npm run build`. Start command: `npx tsx src/index.ts` (no `.env` file on the server, so not `npm start`). Port 4021, health `GET /health`.
- **MCP app**: second Coolify app from the same repo, start command `npx tsx mcp/index.ts`, `GATEWAY_URL` set to the gateway's public URL, its own domain. Set `MCP_PUBLIC_URL` on the gateway to this domain.
- **Volume** for SQLite at `/app/data`. **Keys mount** contains only `hold.json` (mode 0600), mounted read-only; no other keypair is needed on the server.
- **Fresh database**: v2 refuses a v1 file. Remove the old DB file (or use a new `DB_PATH`) before the first v2 start.

## Layout

```
src/     gateway: config, store, chain, auth, accounts, tasks, orders, payouts, rating, http, wiring
web/     React app (landing, firm, agency, linguist, join, pay)
mcp/     MCP server (post_task, get_task, wait_task, approve_task, reject_task, prepare_payment, pay_task)
scripts/ wallet setup, devnet e2e flow
spike/   first x402 devnet proof (throwaway)
docs/    design, ADRs, roadmap
```

Slices and their rules: [ADR 0019](docs/adr/0019-module-layout-v2.md). Secrets: `keys/` and `.env` are never committed.
