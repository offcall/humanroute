# ADR 0019: Module Layout v2

## Status

Proposed. Supersedes ADR 0009. Amended by ADR 0037 (import exceptions for test files).

## Context

ADR 0009 split `src/` into seven layered modules for v1: one expert, one job per payment, and a flat `store` that holds every table and all SQL. The v2 demo adds firms, agencies and linguists, Sign-In With Solana, orders of many tasks paid by one x402 payment, split payouts, three web cabinets and a remote MCP server. With a flat `store`, every feature would edit the same files, push them past the ~100 line limit and couple unrelated features. Several agents build v2 in parallel, so each needs a disjoint folder and fixed import edges.

## Decision

`src/` is split into vertical slices. A slice is a folder `src/<slice>/` with `index.ts` (re-exports only), `types.ts` (types and side-effect interfaces), `sql.ts`, `migrations.ts`, logic files by responsibility, and `routes.ts`. A slice without tables has no `sql.ts` or `migrations.ts`; a slice without HTTP has no `routes.ts`. Other slices import it only through `index.ts`.

| Slice | Owns tables | May import |
|---|---|---|
| config | - | none |
| store | schema_migrations | config |
| chain | - | config |
| auth | nonces, sessions, login_requests (ADR 0034) | store, config |
| accounts | firms, agencies, linguists, memberships, invites, linguist_languages, mcp_tokens | store |
| orders (from payments) | orders, payments, orphans | store, config, accounts, tasks |
| tasks (from jobs) | tasks | store, accounts |
| payouts | transfers | store, chain, tasks |
| rating | - (reads) | store, tasks |
| notify (optional) | push_subscriptions | store, config, accounts |
| http | - | routes of all slices (composition only) |

- Each table has exactly one owning slice; only that slice's `sql.ts` reads or writes it. `rating` reads through the `tasks` index, not its SQL.
- `store` holds only the db handle, `transaction(fn)` and the migration runner. Each slice exports its migrations from `migrations.ts`; `src/index.ts` passes them to `store` in table order, tracked in `schema_migrations`. `sql/*.sql` and the v1 tables are dropped; a v1 database is refused at startup (devnet only; default, owner to confirm).
- Writes that span slices run in one `store.transaction` and go through the other slice's `index.ts` (for example, `orders` creates an order and its tasks via `tasks`).
- Session identity: `auth` exports the session middleware; `http` mounts it and passes a session lookup into each slice's routes. Slices other than `http` never import `auth`. Roles and the MCP token lookup live in `accounts`.
- Money moves only from `src/payouts/`. `tasks`, `orders`, `rating` and `http` only record decisions. `payouts` imports `tasks`, never the reverse, and turns each decided task into exactly one `pending` transfer (one outgoing transaction per task). Task states, timers, split and memos are owned by ADR 0023 and ADR 0024.
- At claim, the task row snapshots the payee wallets (linguist, agency) next to the refund wallet (firm), so `payouts` needs only `tasks`. Config values for slices that do not import `config` (for example payout shares) are passed in by `src/index.ts`.
- Processes: the gateway (`src/`) stays one Node process with Hono, SQLite and the payout worker (ADR 0007), and serves `web/dist` as static files. `web/` is the React + Vite frontend (ADR 0026). `mcp/` is a separate process that talks to the gateway only over HTTP (ADR 0027).
- `web/`, `mcp/`, `agent/` and `scripts/` are outside `src/`. `src/` never imports them; they never import `src/` internals, only `import type` from `src/<slice>/index.ts`.
- `src/index.ts` wires config, store, chain, preflight, the payout worker and HTTP.
- Side effects (chain, facilitator, clock, db) sit behind small interfaces in each slice's `types.ts`. Files stay <= ~100 lines. No classes. Amounts are `bigint` base units.
- `notify` is optional and built only if ADR 0029 is taken.
- Old to new: `payments` -> `orders`, `jobs` -> `tasks`, `store` tables -> owning slices, `payouts/send` -> split + ATA (ADR 0024), `http` -> composition + static `web/dist`. Removed: the secret-link inbox, `EXPERT_WALLET`, `keys/expert.json`, the single `SLA_SECONDS`.

## Alternatives

- Keep ADR 0009 layers with a flat `store`: rejected, `store` would own every table and every feature would edit it.
- One package or workspace per slice: rejected, too much setup for a hackathon.
- `tasks` inserts transfers itself: rejected, it closes the cycle `tasks` <-> `payouts` or lets `tasks` write a table it does not own.

## Consequences

- The import graph has no cycles: `config` <- `store`/`chain` <- `auth`/`accounts` <- `tasks` <- `orders`/`payouts`/`rating` <- `http`; no slice imports `orders`, `payouts`, `rating` or `http` except `http`.
- Parallel streams own disjoint slice folders.
- A new edge between slices needs a new ADR that supersedes this one once it is accepted.
- AGENTS.md must point its import rule to ADR 0019 instead of ADR 0009.
- The v1 devnet database must be reset.
- The terms "job" and single recipient in ADRs 0003 and 0005 read as "task" and split payout until ADRs 0023 and 0024 supersede them.
