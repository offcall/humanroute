# ADR 0037: Test toolchain: Vitest projects and test layout

## Status

Proposed. Lifts the owner's test deferral (owner, 2026-11-07). Replaces the "tests are deferred" sentence of ADR 0011; the rest of ADR 0011 stays.

## Context

The repository has no tests; `npm run check` runs Biome and `tsc`, and `npm run e2e:devnet` is a manual bash run on devnet. The gateway already keeps side effects behind injected interfaces (clock and ids in each slice's deps, `SolanaClient`, the x402 `FacilitatorClient`, the push sender), and SQLite opens as `:memory:`. The tests must cover the gateway, the MCP server, the web (which imports CSS and JSX), the agent scripts, and the real processes on a local validator. ADR 0002 requires an ADR for a tool change.

## Decision

- Runner: Vitest (pinned, `vitest.config.ts`), on the project's Vite. Pool `forks` (better-sqlite3 is native; one handle per worker), at most 2 workers.
- Projects:
  - `unit`: `src/**`, `mcp/**`, `contracts/**` `*.test.ts`, Node environment.
  - `web`: `web/src/**/*.test.tsx`, jsdom, React Testing Library. Only a few component tests where a fix needs one; the browser e2e is the web's coverage.
  - `e2e`: `e2e/**/*.test.ts` against real gateway and MCP processes on a local validator (ADR 0038).
  - `e2e-devnet`: the same suite against devnet and x402.org; manual, only with the owner's permission for each run.
  - `smoke`: `e2e/smoke/**`, read-only checks of a running target; no setup.
- Gate: `npm test` runs `unit` and `web`, and `npm run check` runs it after Biome and `tsc`. Nothing in `npm test` starts a validator, opens a port or uses the network. `npm run test:e2e`, `test:e2e:devnet` and `test:smoke` run the others.
- Layout:
  - A test is a `*.test.ts(x)` file next to the code it tests. A slice's own tests import its files directly.
  - `src/testing/` is test-only support: a hand-moved clock and ids, deterministic wallets, a scriptable fake `SolanaClient`, a fake facilitator, request helpers and `createTestGateway`, which wires every slice through `src/wiring` with these fakes and an in-memory database. Production code never imports it.
  - `contracts/` holds tests of contracts between processes (gateway, MCP, web, agent scripts).
  - `e2e/` holds real-process tests: `e2e/env/` (environments and global setup), suites by flow, `e2e/web/` (browser), `e2e/smoke/`.
- Import exceptions to ADR 0019, for test files only: `src/testing/` may import any slice's `index.ts` and `src/wiring`; a `*.test.ts` may import `src/testing/`; `contracts/` and `e2e/` may import `src/`, `mcp/` and `web/public/agent/`, and `contracts/` may load `web/src/` parsers at runtime (dynamic import; the web `tsconfig` type-checks them), to compare both sides of a contract or start a process. Production files keep the ADR 0019 rules.
- `tsc` checks `contracts/`, `e2e/` and `vitest.config.ts`; web tests are checked by the web `tsconfig`.
- Determinism (AGENTS.md): unit and web tests use no network, no wall clock, no sleeps and no machine-specific paths. The fake facilitator answers `getSupported` with `extra.feePayer`, which the x402 middleware reads when it starts.
- Each row of the failure table in `docs/design/flow.md` has at least one test.

## Alternatives

- `node:test` through `tsx`: no new dependency, but it cannot load the web's CSS and JSX and has no projects; two runners would be needed.
- A top-level `test/` folder: it needs import rules of its own; colocated tests reuse the slice rules.
- A local validator in `npm test`: slow and heavy; it stays in the `e2e` project.

## Consequences

- New dev dependencies: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`.
- `npm run check` takes longer by the unit and web run.
- The fakes implement the real interfaces, so `tsc` flags them when an interface changes.
- No coverage report and no CI.
