# HumanRoute API v2

HTTP contract of the v2 gateway: routes, auth, shapes, memos, timers. Draft: streams A (orders, tasks, payouts) and B (auth, accounts, rating) own their sections and may refine them; C (web) and D (MCP, pay page) consume them. Layout in ADR 0019, decisions in [`docs/adr/`](../adr/README.md).

## Conventions

- JSON request and response bodies, UTF-8. Ids (`firmId`, `taskId`, `draftId`, ...) are opaque strings. Times are ISO 8601 UTC strings.
- Amounts are decimal strings of USDC base units (6 decimals): `"500000"` = 0.50 USDC. Field names end in `Units`. Server side they are `bigint`; never a JSON number.
- Languages are lowercase ISO 639-1 codes (`"en"`, `"es"`). A pair is `{source, target}`.
- Error body: `{error: "<code>", message?: string}`. `code` is a stable snake_case string listed per route.

| Status | Meaning |
| --- | --- |
| `400` | Malformed JSON or path parameter. |
| `401` | No or invalid session cookie / MCP token. |
| `402` | x402 payment required or payment verification failed (`PAYMENT-REQUIRED` header). |
| `403` | Authenticated, wrong role or not the owner. |
| `404` | Unknown id, or not visible to this caller. |
| `409` | State conflict: lost compare-and-set, already done, late, account exists. |
| `422` | Body or id fails validation (`invalid_body` or a route-specific code). |
| `502` | Payment settled but not recorded (`orphan_payment`, ADR 0016). |
| `503` | Preflight failing (`not_ready`, with reasons, ADR 0008). |

## Auth

- **Cookie session** (ADR 0020): Sign-In With Solana. `POST /api/auth/verify` sets cookie `hr_session` (HttpOnly, `SameSite=Lax`, `Secure` on https), TTL 7 days. Used by the three cabinets. Cookie-authenticated POST/PUT require `content-type: application/json` (CSRF).
- **MCP Bearer token**: `Authorization: Bearer <mcpToken>`; one token per firm, created with the firm, shown in the firm cabinet (ADR 0021). The MCP process forwards the caller's token to the gateway, which resolves it to the firm. Stored in the accounts DB in plaintext (ADR 0027).
- **x402**: `PAYMENT-SIGNATURE` header, verified and settled by the facilitator (ADR 0004).
- **None**: public.
- Roles: `firm`, `agency`, `linguist`, derived from `accounts` rows. A wallet may hold several roles, at most one of each (ADR 0020).

## Routes

Columns: auth / role, request, response (success), errors (codes beyond the conventions), owner slice. No route moves money: approve, reject and timers only record a decision; `src/payouts/` sends (AGENTS.md chain safety).

### auth (stream B)

| Route | Auth / role | Request | Response | Errors | Slice |
| --- | --- | --- | --- | --- | --- |
| `POST /api/auth/nonce` | none | `{wallet}` | `200 {nonce, message}` (server-built SIWS text, nonce valid 5 min, single use) | `422 invalid_body` | auth |
| `POST /api/auth/verify` | none | `{wallet, nonce, signature}` (base64 Ed25519 over the stored text) | `200` + cookie | `401` (one generic error for every failure) | auth |
| `POST /api/auth/logout` | cookie (optional, idempotent) | `{}` (JSON) | `204`, deletes the session row, clears `hr_session` | `400 malformed_body` | auth |
| `GET /api/me` | cookie, any | - | `200 {wallet, firm?, agency?, linguist?}` | `401` | accounts |

### accounts (stream B)

| Route | Auth / role | Request | Response | Errors | Slice |
| --- | --- | --- | --- | --- | --- |
| `POST /api/firm` | cookie, any | `{name}` | `201 {firm, mcp: {url, token}}`; firm and token in one transaction | `409` firm exists for wallet | accounts |
| `GET /api/firm` | cookie, firm | - | `200 {firm, mcp: {url, token}}`; `url` = `MCP_PUBLIC_URL` | `404` no firm | accounts |
| `POST /api/agency` | cookie, any | `{name}` (agency languages not stored) | `201 {agency}` | `409` agency exists | accounts |
| `GET /api/agency` | cookie, agency | - | `200 {agency, inviteUrl}`; `inviteUrl` null before first invite | `404` no agency | accounts |
| `POST /api/agency/invite` | cookie, agency | - | `200 {code, url}`; idempotent, one permanent link `<PUBLIC_BASE_URL>/join/<code>` | `403` | accounts |
| `POST /api/linguist/join/:inviteCode` | cookie, any | - | `200 {linguist, agency}`; idempotent for the same agency | `404` unknown code, `409` in another agency | accounts |
| `PUT /api/linguist/languages` | cookie, linguist | `{pairs: [pair]}` (1..10, source != target, replaces all) | `200 {pairs}` | `403`, `422 invalid_body` | accounts |
| `GET /api/linguist` | cookie, linguist | - | `200 {pairs, earnedUnits, tasks: [TaskView]}` | `404` no linguist | accounts |

`GET /api/linguist` is the linguist cabinet; there is no `GET /api/linguist/tasks`. One agency per linguist. The agency cabinet has no linguist list: invite link, income and rating only. Amounts in cabinets count only `confirmed` transfers (ADR 0018). Firm money totals come from `GET /api/rating/firm/:id`.

### orders (stream A)

| Route | Auth / role | Request | Response | Errors | Slice |
| --- | --- | --- | --- | --- | --- |
| `POST /api/orders/draft` | MCP Bearer, firm | `{text, sourceLang, targets: [{targetLang, draft}], meta?}` (1..5 targets, distinct) | `201 {draftId, payUrl, priceUnits, totalUnits, taskCount}`; `payUrl` = `<PUBLIC_BASE_URL>/pay/<draftId>` | `422 invalid_body` | orders |
| `GET /api/orders/draft/:draftId` | none (`draftId` is unguessable) | - | `200 {draftId, payUrl, state: "draft" \| "paid", sourceLang, targetLangs, taskCount, priceUnits, totalUnits, payTo, mint, network, orderId?, tasks?: [{taskId, targetLang, publicState}]}`; `orderId` and `tasks` once paid | `404` (unknown or older than 30 min and unpaid) | orders |
| `POST /x/orders/:draftId` | x402, any wallet | no body (content is in the draft) | `201 {orderId, taskIds, payTx}` + `PAYMENT-RESPONSE`; replay of the same payment returns the same `201` | `402`, `404`, `409 draft_paid` (other payment), `409 payment_reused` (other draft), `502 orphan_payment`, `503 not_ready` | orders |
| `GET /api/orders` | cookie, firm | - | `200 {serverTime, orders: [{orderId, payTx, totalUnits, createdAt, tasks: [TaskView]}]}`: the firm's orders; `serverTime` as on the board | `403` | orders |
| `GET /api/orders/:id` | cookie firm owner, or MCP Bearer of the same firm | - | `200 {serverTime, orderId, firmId, payTx, payer, totalUnits, createdAt, tasks: [TaskView]}` | `403`, `404` | orders |

`GET /api/orders/draft/:draftId` serves the pay page and MCP `get_task` (ADR 0027). Drafts live 30 min. `PAYMENT-REQUIRED` for `/x/orders/:draftId`: exact scheme, `amount = totalUnits = taskCount x priceUnits` of `USDC_MINT`, `payTo` = hold wallet. The x402 payer becomes every task's refund wallet. Price is fixed per task from config (`TASK_PRICE_USDC`). Paying creates the order and its N `open` tasks in one SQLite transaction (ADR 0022).

### tasks (stream A)

`TaskView` = `{taskId, orderId, firmName, agency, translatorNo, sourceLang, targetLang, text, draft, result, state, publicState, priceUnits, claimDeadline, workDeadline, reason, transfer}`; `result`, `workDeadline`, `reason`, `transfer` may be null. `firmName` is the ordering firm; `agency` = `{id, name}` of the claimer's agency and `translatorNo` = the claimer's 1-based rank inside it by join order, both null while `open` (ADR 0033). `transfer` = `{status, payTx, memo, attempts, lastError, explorerUrl, confirmedAt, earnedUnits}` (`?cluster=devnet`); `confirmedAt` = ISO time of a `confirmed` transfer, else null; `earnedUnits` = the linguist leg of a payout, only in the claimer's own views (`GET /api/linguist`, the claimer's `GET /api/tasks/:id`, claim, submit), null for refunds and for every other caller (ADR 0033).

| Route | Auth / role | Request | Response | Errors | Slice |
| --- | --- | --- | --- | --- | --- |
| `GET /api/board` | cookie, linguist | - | `200 {serverTime, tasks: [{taskId, firmName, sourceLang, targetLang, priceUnits, claimDeadline, text, draft}]}`: `open` tasks in the linguist's pairs only | `403` | tasks |
| `POST /api/tasks/:id/claim` | cookie, linguist | - | `200 TaskView` (`claimed`); first claim wins; snapshots linguist and agency wallets | `404` (unknown or outside pairs), `409 claim_taken`, `409 claim_closed` | tasks |
| `POST /api/tasks/:id/submit` | cookie, linguist (claimer) | `{result}` (non-empty) | `200 TaskView` (`submitted`) | `403`, `409 late` (after the work deadline), `409 bad_state`, `422 invalid_body` | tasks |
| `POST /api/tasks/:id/approve` | cookie firm owner, or MCP Bearer of the owner firm | - | `200 TaskView` (`approved`, public `paying_out`) | `403`, `409 bad_state` (not `submitted` or already decided) | tasks |
| `POST /api/tasks/:id/reject` | cookie firm owner, or MCP Bearer of the owner firm | `{reason}` (non-empty, <= 1000 chars) | `200 TaskView` (`rejected`, public `refunding`) | `403`, `409 bad_state`, `422 reason_required` | tasks |
| `GET /api/tasks/:id` | cookie firm owner, claimer, claimer's agency; or MCP Bearer of the owner firm | - | `200 {serverTime, ...TaskView, executorPairs}`: `serverTime` as on the board, for server-based countdowns; `executorPairs` = the claimer's `[pair]` for the owner firm, null while `open` and for other callers | `403`, `404` | tasks |

Approve and reject come from the firm cabinet or from MCP `approve_task` / `reject_task`, which Claude calls only after asking the user (ADR 0030). With a Bearer header the token decides: unknown is `401`, another firm's `403`.

### rating (stream B)

| Route | Auth / role | Request | Response | Errors | Slice |
| --- | --- | --- | --- | --- | --- |
| `GET /api/rating/agency/:id` | none | - | `200 {agencyId, ratingPct, approved, rejected, late, paidUnits}` | `422` bad id format | rating |
| `GET /api/rating/firm/:id` | none | - | `200 {firmId, rejectPct, approved, rejected, spentUnits, refundedUnits}` | `422` bad id format | rating |

Formulas in ADR 0025: `ratingPct` = approved / (approved + rejected + late), `rejectPct` = rejected / (approved + rejected), integer percent, `null` when the denominator is 0. Counts and percents are JSON numbers; money fields are decimal strings. Unknown id: zero counts, `null` percent (no `404`).

### static, health and SPA (http slice; content by stream C, pay page by D)

| Route | Auth / role | Response | Slice |
| --- | --- | --- | --- |
| `GET /health` | none | `200`, shape unchanged from v1 | http |
| `GET /`, `/firm` (the client redirects to `/firm/jobs`), `/firm/jobs`, `/firm/jobs/:orderId/:lang`, `/firm/review`, `/agency`, `/linguist`, `/linguist/tasks`, `/linguist/tasks/:taskId`, `/linguist/wallet`, `/join/:code`, `/pay/:draftId` | none (data calls carry auth) | `index.html` from `web/dist` (SPA fallback) | http |
| `GET /assets/*`, `/manifest.webmanifest` | none | static files from `web/dist` (manifest as `application/manifest+json`); other paths fall back to `index.html` | http |

Unknown `/api/*` and `/x/*` paths return `404 {error: "not_found"}`, never the SPA.

## MCP tool mapping (ADR 0027, stream D)

| Tool | Gateway call | Returns |
| --- | --- | --- |
| `post_task` | `POST /api/orders/draft` | `{draftId, payUrl, totalUnits, taskCount}` and `seen: draft`; never pays |
| `get_task` | `GET /api/orders/draft/:draftId`, then `GET /api/orders/:id` once paid | `{draftId, state, orderId?, tasks?}`; once paid each language's `taskId`, state, deadlines, result (a JSON string) and reason; a `seen` line for `wait_task` |
| `approve_task` | `POST /api/tasks/:id/approve` (Bearer) | the decided task; only after the user approved it in chat (ADR 0030) |
| `reject_task` | `POST /api/tasks/:id/reject` (Bearer) `{reason}` | the decided task; only after the user rejected it in chat, with the user's reason |
| `wait_task` | the `get_task` reads, every 2 s | on the first change of the draft state or a language's public state (a change only to `paying_out` or `refunding` does not count): a `changes` line, the `get_task` text and the new `seen`; a progress notification at once and every 30 s (with the pay link while unpaid); cap 60 min; retries failed reads for 30 s, the gateway's 404 `not_found` ends it at once (ADR 0031) |

## Task states and memos (ADR 0023, 0024)

```
tasks.state   open ──claim──> claimed ──submit──> submitted ──approve──> approved
                │                │                    └──reject──> rejected
                │                └──work window over──> expired_late
                └──claim window over──> expired_unclaimed

publicState   open, claimed, submitted (tasks.state)
              paying_out / refunding   decision made, transfer not confirmed
              paid_out / refunded      transfer confirmed
```

Each decided task gets exactly one transfer (unique `task_id`); `transfers.status` is unchanged from [`flow.md`](flow.md) (`pending -> sent -> confirmed | failed`, requeue ADR 0017). Only `src/payouts/` sends.

| Decision | Transaction | Memo |
| --- | --- | --- |
| `approved` | one tx: legs linguist / agency / fee (config shares), idempotent ATA creation for missing recipients in the same tx | `hr:<taskId>` |
| `rejected` | full `priceUnits` to the refund wallet; linguist and agency get nothing; agency rating drops | `hr:<taskId>:rejected` |
| `expired_unclaimed` | full `priceUnits` to the refund wallet | `hr:<taskId>:unclaimed` |
| `expired_late` | full `priceUnits` to the refund wallet | `hr:<taskId>:late` |

## Config names (shared `src/config`, coordinator)

| Name | Meaning |
| --- | --- |
| `TIMER_MODE` | `video` or `public` preset (ADR 0028) |
| `CLAIM_WINDOW_SECONDS` | from payment to claim; `video` 60, `public` 1800; overrides the preset |
| `WORK_WINDOW_SECONDS` | from claim to submit; `video` 180, `public` 3600; overrides the preset |
| `TASK_PRICE_USDC` | fixed price per task |
| `AGENCY_SHARE_BPS`, `FEE_SHARE_BPS` | split shares, 1800 and 200; linguist gets the rest (8000) and the rounding remainder (ADR 0024) |
| `FEE_WALLET` | fee leg recipient |
| `PUBLIC_BASE_URL`, `MCP_PUBLIC_URL` | base for pay and invite links, SIWS domain; MCP URL shown in the firm cabinet |

## Removed endpoints

`POST /x/translate`, `GET /jobs/:id`, `GET /jobs/:id/view`, `GET /inbox/:token`, `POST /inbox/:token/jobs/:id/answer`. Also removed: `EXPERT_WALLET`, `keys/expert.json`, `INBOX_TOKEN`, `SLA_SECONDS`.
