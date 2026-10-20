# ADR 0009: Module Layout

## Status

Accepted

## Context

Several agents write code in parallel. Without a recorded layout, a new import can close a cycle or let chain code leak into HTTP handlers, which would break the "only `payouts` sends money" rule (ADR 0005).

## Decision

`src/` has seven modules. A module is a folder with `index.ts`; other modules import it only through that `index.ts`.

| Module | Owns | May import |
| --- | --- | --- |
| `config` | Env and keypair parsing into `Config` | none |
| `store` | SQLite handle, migrations, job/transfer/payment rows | `config` |
| `chain` | Solana RPC client interface, transfer build/sign, status, memo lookup | `config` |
| `jobs` | Job lifecycle: answer, SLA sweep, claim (decision + transfer intent) | `store` |
| `payments` | x402 route, payment id, fingerprint, job creation after settle | `store`, `config` |
| `payouts` | Worker: sign, send, confirm, resend policy | `store`, `chain`, `jobs` |
| `http` | Hono app, inbox, status views | `payments`, `jobs`, `store` |

- `src/index.ts` wires everything: config, store, preflight, worker, HTTP server.
- Side effects (chain, facilitator, clock, db) sit behind small interfaces in each module's `types.ts`.
- `agent/` (demo agent) and `scripts/` (wallet setup, e2e) live outside `src/`. `src/` never imports them; they never import `src/` internals, only types through `src/<module>/index.ts`.
- Files stay small (target <= 100 lines). No classes.

## Consequences

- Dependencies point down the table; there are no cycles.
- A new edge between modules updates this ADR.
