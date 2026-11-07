# ADR 0038: E2E environments

## Status

Accepted (owner, 2026-11-07). Builds on ADR 0037 (Vitest projects) and ADR 0011 (devnet e2e outside the check).

## Context

ADR 0037 adds the `e2e`, `e2e-devnet` and `smoke` projects. The real proof of HumanRoute is a paid order, a settlement and a payout or refund on chain, run through the real gateway and MCP processes. Devnet needs the internet, funded keys and the owner's permission for each run, so it cannot be the everyday e2e. `@x402/svm` accepts only the mainnet, devnet and testnet CAIP-2 ids (finding 17). The browser x402 client has no `rpcUrl` and always calls the devnet RPC host (finding 7).

## Decision

- `e2e` (default, `npm run test:e2e`) runs offline and without money on a local chain:
  - `solana-test-validator` (Agave CLI in the user's home, or `SOLANA_TEST_VALIDATOR`), bound to 127.0.0.1 on free ports, with its ledger in a fresh temp dir and a small `--limit-ledger-size`. The ledger is removed at the end of every run, on failure and on SIGINT/SIGTERM.
  - The run uses the devnet CAIP-2 id (`SOLANA_NETWORK`) with a loopback `RPC_URL`. The run's own 6-decimal mint is `USDC_MINT`. The hold, fee, facilitator and firm keys are made fresh for each run and written mode 600 into the temp dir.
  - The local facilitator is the SDK's exact SVM facilitator (`@x402/svm/exact/facilitator`, `@x402/core/facilitator`) on a loopback HTTP server with the x402.org wire protocol. It verifies by simulation and settles as fee payer, for both link payments and delegate payments (ADR 0036). It is not a simulator. One shim applies, in the facilitator process only (`e2e/env/kitShim.ts`): `@x402/svm` 2.28.0 imports the payer's Ed25519 key as non-extractable, and `@solana/kit` 8.5 `verifySignature` refuses such keys, so raw Ed25519 public-key imports are made extractable. WebCrypto still checks each signature.
  - The gateway (`src/index.ts`), the MCP server (`mcp/index.ts`) and the facilitator run as child processes (`node --import tsx`), each in its own process group. Readiness is a bounded poll: gateway `/health` `ready: true`, MCP `GET /mcp` 405, facilitator `/supported`. Teardown kills each group.
  - Egress block: every child process and every test worker loads a guard (`e2e/env/egress.ts`). The guard refuses TCP connects and DNS lookups to non-loopback hosts and logs them. Any logged attempt fails the run.
- Browser e2e (`e2e/web/`) uses the Playwright library from Vitest with headless Chromium:
  - Only one Chromium runs on the host at a time. Each browser file takes the mkdir lock `/tmp/hr-shot.lock` and releases it.
  - Each role gets its own context with a fake Phantom. The page only moves bytes; Node signs over `exposeBinding` and sends to the run's RPC.
  - `page.route` answers the devnet RPC host from the local RPC. It aborts and records any other non-loopback request, and a case fails on any recorded request. Chromium starts with a dead proxy, so its own traffic cannot leave the host either.
  - `npm run test:e2e` and `npm run test:e2e:devnet` build the web first (`npm run build && vitest run --project …`), so browser runs never use a stale `web/dist`.
- `e2e-devnet` (`npm run test:e2e:devnet`, alias `npm run e2e:devnet`, ADR 0044) runs the same files against devnet and x402.org. It uses the hold and agent keys from `keys/` (or `HOLD_KEYPAIR_PATH`, `AGENT_KEYPAIR_PATH`), requires `FEE_WALLET`, and funds fresh firm wallets from the agent wallet. It runs manually and only with the owner's permission for each run. Its setup throws unless `E2E_DEVNET=1`, which only that script sets, so a bare `npx vitest run` cannot spend devnet funds. Each firm slot gets its own devnet USDC amount (`DEVNET_FIRM_UNITS` in `e2e/support/firms.ts`, about 9 USDC upfront); setup checks the agent balance first. Localnet-only suites (`e2e/environment.e2e.test.ts`, `e2e/order-restart.e2e.test.ts`) skip there.
- `smoke` (`npm run test:smoke`) makes read-only GET checks of a running target: `SMOKE_GATEWAY_URL`, plus optionally `SMOKE_MCP_URL` and `SMOKE_MCP_TOKEN`. It has no setup and skips without a target. `node --import tsx e2e/env/serve.ts` starts a localnet target and prints these variables.

## Alternatives

- A hand-written facilitator simulator: no SDK verification, so it would prove less than x402.org does.
- A custom localnet CAIP-2 id: `@x402/svm` rejects it.
- An `rpcUrl` option in the browser client: a production change only for tests. Routing in the test does the same.
- Devnet as the default e2e: needs the internet, funds and the owner's permission for each run.

## Consequences

- E2E needs the Agave CLI (~260 MB) and Playwright's headless Chromium (~280 MB) on the host.
- A full localnet run takes minutes, most of it waiting on a real claim window and on blockhash expiry. It uses one Vitest worker.
- On localnet the hold wallet is younger than the 600 s window of the memo guard (ADR 0039). A restart after a dropped send therefore ends in operator action, not a resend; the resend path needs an older hold wallet (devnet).
- The facilitator shim must be revisited when `@x402/svm` or `@solana/kit` changes.
- Test harness code and scripts send transactions only with test, firm or agent keys, never with the hold key (the hold is used only for its public key). The AGENTS.md rule that transactions are sent only from `src/payouts/` covers gateway code.
