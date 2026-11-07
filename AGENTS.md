# AGENTS.md

Instructions for coding agents in this repo.

## Project

HumanRoute lets a firm order human translation from an AI agent. The firm pays one x402 payment in USDC (Solana devnet) for an order of tasks. The gateway holds it, then pays each task's linguist, agency and fee, or refunds the firm.

TypeScript, Hono, SQLite, one process. Toolchain and architecture decisions live in `docs/adr/`. Devnet only.

## Language

- Code, identifiers, comments, docs, ADRs, README, commits, tests, agent instructions: English.

## Communication

- Answer the question asked. *Why*/*cause*: answer from code, logs, existing output. No commands, tests, reviews without user approval.
- Hypothesis: mark it as a hypothesis and state what would confirm it. Never present a guess as the cause.
- Multi-step change: send a short plan and task list first. Wait for approval.
- "Stop" or "change nothing" holds until the user lifts it.

## Code Quality

Readable, modular, easy to change, split by responsibility. No needless abstraction.

- Strict TypeScript. No `any`; use `unknown` and narrowing.
- Validate data at boundaries: request bodies, x402 headers, facilitator and RPC responses, env, keypair files. Hand-written parsers return a typed value or an error.
- Side effects (chain, facilitator, clock, database) behind small replaceable interfaces in `types.ts`. Core logic testable without them.

## Code Style

- Names >= 3 chars. Name strings say what they name: `jobId`, `payTx`, `holdKey`.
- Type names have no suffix: `Job`, not `JobRow`.
- No `as` casts, no non-null `!`. No fallbacks the types already cover (`?? null`, `= {}`).
- Generic params default to `unknown`.
- Fixed string sets: `enum`, or a library constant.
- Every `if` and `for` body in `{}`. Blank line between logical blocks.
- Short functions: `const name = (…) => …`. No classes, DI, factories, managers.
- File <= ~100 lines. Comment only where the name is not enough.
- Module = folder with `index.ts`. Modules import each other only through it; files inside a module import each other directly.
- Allowed imports between modules are listed in ADR 0019 (module layout). Respect them; changing them requires a new ADR.
- `agent/` and `scripts/` are never imported from `src/` and never import `src/` internals (types via `src/<module>/index.ts` are fine).
- In a module: types in `types.ts`, SQL in `sql.ts`, functions in files by responsibility.

## Money

- Amounts only as `bigint` base units (USDC has 6 decimals). Never `number` for USDC.
- SQLite stores amounts as `TEXT` or `INTEGER`; parse back to `bigint` at the store boundary.

## Chain Safety

- Transactions are sent only from `src/payouts/`.
- A new send starts only from a `pending` transfer row.
- Changing resend or retry rules requires a new ADR.

## Secrets

- Never read, print or commit `keys/*.json` or `.env`.
- Logs contain only public keys, signatures and job ids.

## Minimal Changes

Smallest correct change. Never:

- refactor, rename, reformat unrelated code;
- change public APIs without need;
- add dependencies without clear reason;
- change unrelated behavior.

Keep the existing architecture unless an ADR documents the reason to change.

New generated, local or secret files (dependencies, build/test output, caches, env files, keys, databases): update `.gitignore` in the same commit.

## ADR Rules

Before a significant architectural decision:

1. Read the ADRs in `docs/adr/`.
2. Check whether the decision is already documented.
3. New decision: write the ADR before or with the implementation, status `Proposed`. Add a row to `docs/adr/README.md`.
4. `Proposed` ADR: edit freely while the step is in review. Step accepted: status `Accepted`.
5. Never rewrite an accepted ADR decision. Supersede it with a new ADR and mark the old one superseded.

Significant: dependencies, toolchain, module boundaries, public interfaces, data formats, persistence, payment and payout rules, workflow.

Format:

- File: `docs/adr/NNNN-kebab-case-title.md`, sequential numbers.
- Title: `# ADR NNNN: Title`.
- Sections: `## Status`, `## Context`, `## Decision`, optional `## Alternatives`, `## Consequences`.
- Short. One decision per ADR.

## Testing

Vitest, layout and projects in ADR 0037. `npm test` (unit + web) is part of `npm run check`; the local e2e is `npm run test:e2e` (ADR 0038).

- Behavior change ships with tests in the same commit.
- Tests are deterministic: no real network, no wall-clock or machine-specific paths. Unit tests never touch the network.
- Devnet runs only via `npm run e2e:devnet` or `npm run test:e2e:devnet`, outside `npm run check`, and only with explicit user permission for each run.
- Every row of the failure table in `docs/design/flow.md` has at least one test.

## Workflow

`inspect → plan → implement → validate → commit → report`

Before every commit: `npm run check` (Biome + tsc) passes. Never commit or push unless the user asks.

Docs, ADR index rows and README updates go in the same commit as the behavior they describe. Check `README.md`, `docs/`, `docs/adr/README.md` for stale text before committing.

One commit = one understandable unit. Conventional Commit: `<type>(<scope>): <short description>`, lowercase, type one of `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. No `Co-Authored-By` or "Generated with" trailers.

ADR edits go in their own commit. `AGENTS.md` changes: own `docs(agents): ...` commit, never with `.gitignore`, code or other changes.
