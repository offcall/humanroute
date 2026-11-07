# Setup and operations

What the [README quick start](../README.md#quick-start) leaves out.

## Environment

`npm start`, `npm run dev` and `npm run requeue` read `.env`; `npm run setup:wallets` reads it if present. `npm run mcp` and `npm run e2e:devnet` do not: set their variables in the shell.

| Variable | Default | Meaning |
| --- | --- | --- |
| `RPC_URL` | devnet RPC | Solana JSON-RPC |
| `SOLANA_NETWORK` | devnet CAIP-2 id | x402 network |
| `FACILITATOR_URL` | x402.org facilitator | verifies and settles payments |
| `USDC_MINT` | devnet USDC | payment and payout mint |
| `HOLD_KEYPAIR_PATH` | `keys/hold.json` | hold wallet: receives payments, sends payouts and refunds (mode 0600) |
| `AGENT_KEYPAIR_PATH` | `keys/agent.json` | scripts and devnet e2e only: funds the e2e firm wallets |
| `FEE_KEYPAIR_PATH` | `keys/fee.json` | `scripts/fee-pubkey.ts` only |
| `PORT`, `DB_PATH`, `COMMITMENT` | 4021, `data/humanroute.db`, `confirmed` | server, SQLite file, `confirmed` or `finalized` |
| `TASK_PRICE_USDC` | `0.50` | price of one task |
| `TIMER_MODE` | `video` | `video` (claim 60 s, work 180 s) or `public` (claim 30 min, work 60 min), ADR 0028 |
| `CLAIM_WINDOW_SECONDS`, `WORK_WINDOW_SECONDS` | empty | override the preset |
| `LINGUIST_SHARE_BPS`, `AGENCY_SHARE_BPS`, `FEE_SHARE_BPS` | 8000, 1800, 200 | payout split, sum 10000 |
| `FEE_WALLET` | required | address of the fee leg |
| `PUBLIC_BASE_URL` | required | base of invite and pay links, SIWS domain; `https:` turns on Secure cookies |
| `MCP_PUBLIC_URL` | required | MCP URL shown to firms, with the `/mcp` path |
| `DRAFT_TTL_SECONDS`, `SESSION_TTL_SECONDS`, `NONCE_TTL_SECONDS` | 1800, 604800, 300 | lifetimes |
| `WEB_DIST_DIR` | `web/dist` | built web app; missing, non-API paths answer 503 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | empty | Web Push (ADR 0029): all three or none (push off). Subject: a real `mailto:` or `https:`; Apple rejects placeholders. Keys: `npx web-push generate-vapid-keys` |
| `GATEWAY_URL`, `MCP_PORT` | required, 4022 | MCP process only |

Invalid configuration exits 1. A failing preflight (hold without SOL or token account, facilitator not ready for devnet) keeps the server up: `/health` shows `ready: false`, payments answer `503 not_ready`, payouts pause. Preflight reruns every 60 s.

A v1 database is refused (ADR 0022): use a fresh `DB_PATH`.

No devnet USDC? `npm run setup:wallets -- --fallback-mint` creates a 6-decimal SPL mint (authority = hold), mints 100 to the agent and records it in `keys/test-mint.json`. Set `USDC_MINT` to it.

## Auto-pay

Optional, ADR 0036.

1. In the firm cabinet, **Connect Claude** shows a command. Run it on the Claude Code machine: it downloads `sign.mjs` and `setup.mjs` and creates `~/.humanroute/agent-key.json` (mode 0600).
2. Enable auto-pay with a limit. Phantom (devnet) signs an SPL `approve` that lets the agent key spend up to the limit from the firm's USDC account. The firm wallet needs a little devnet SOL (https://faucet.solana.com). The limit is revocable.

Claude's behavior:

- It offers auto-pay only when the draft's chain snapshot shows delegate, allowance and balance cover the total. It does not check the local key.
- Not told to pay: it shows the pay link and waits for payment at once; the user need not say "paid".
- Told to pay: it signs with `sign.mjs` and pays through `prepare_payment` and `pay_task`, which recheck. One wait per draft.
- Unknown payment outcome: checked before any new payment. An orphan is never paid again. Refunds go to the firm's login wallet.

## Frontend development

`npm run web:dev`: Vite, proxies `/api`, `/x`, `/health` to the gateway on 4021.

## Devnet e2e

`npm run e2e:devnet` (= `npm run test:e2e:devnet`) runs the e2e suite on devnet and x402.org: SIWS sign-in, order, payment, payout, refunds, checked on chain. Opt-in, outside `npm run check` (ADR 0011, 0044). Spends devnet USDC.

Needs `keys/hold.json`, `keys/agent.json` with about 9 USDC and a little SOL, and `FEE_WALLET` in the shell.

## Deploy on Coolify

- **Gateway app**: Nixpacks, `NIXPACKS_NODE_VERSION=22`, `NIXPACKS_APT_PKGS=python3` (better-sqlite3). Nixpacks runs `npm run build`. Start: `npx tsx src/index.ts` (no `.env` on the server, so not `npm start`). Port 4021, health `GET /health`.
- **MCP app**: second app from the same repo, start `npx tsx mcp/index.ts`, `GATEWAY_URL` = the gateway's public URL, own domain. Set the gateway's `MCP_PUBLIC_URL` to it.
- **Volume** for SQLite at `/app/data`. **Keys mount**: only `hold.json` (mode 0600), read-only.
- **Fresh database**: remove a v1 DB file (or use a new `DB_PATH`) before the first v2 start.

## Operator commands

`npm run requeue -- <transferId|taskId>` moves a failed transfer back to `pending` when ADR 0006 allows it (ADR 0017). It sends nothing; the worker sends. Exit 0 requeued, 2 refused, 1 error.
