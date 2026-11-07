# Roadmap

Not built in the hackathon version. Each item is a product or architecture change; the demo never needs them.

## Product

- **No auto-accept.** Every result waits for the firm's approve or reject. A timer that accepts results is out of scope.
- **Partial payouts.** A task is paid in full or refunded in full. No partial amounts for partly good results.
- **Linguist removal and filters.** The firm cannot exclude a linguist or filter by rating; the board shows every linguist in the matching pair.
- **Public feed and auction.** Tasks are visible only to linguists with a matching pair. No open feed, no bidding, no price discovery.
- **Disputes.** A rejected result is refunded in full; there is no appeal or mediation.
- **Push notifications for firms**, and for linguists beyond new tasks. Linguists get a Web Push for each new task in their pair (ADR 0029); everything else polls the gateway.

## Identity and wallets

- **Wallet Standard.** Only the injected Phantom wallet is supported. Wallet Standard discovery is the next step.
- **Real identity.** Linguists and agencies sign in with a wallet only; no legal identity, KYC or agency verification.
- **Agency languages.** Agencies do not declare languages; only linguists do.
- **Two signed-out tabs.** Two tabs waiting on a login request share the `hr_login` cookie and the stored request id, so they replace each other's request (ADR 0034).
- **Sign out and push.** Sign out unsubscribes this device's push before the logout call succeeds; a failed logout leaves the session without push.
- **Login request and nonce cleanup.** Expired `login_requests` and `nonces` rows are never purged.

## Custody and money

- **Escrow program or multisig custody.** The hold wallet is a hot key on the gateway. An on-chain escrow or multisig is the production design.
- **Fee and splits per agency.** The split is fixed in config; no per-agency or per-firm terms.
- **Mainnet.** Devnet only. Real USDC and mainnet RPC need a separate review.
- **Operator tooling.** Orphan payments are refunded by hand; there is no admin UI.

## Quality

- **Tests.** Vitest unit and web tests run in `npm run check`, real-process e2e on a local validator in `npm run test:e2e`, the same suite on devnet in `npm run e2e:devnet` ([ADR 0037](adr/0037-test-toolchain-vitest.md), [ADR 0038](adr/0038-e2e-environments.md), [ADR 0044](adr/0044-devnet-e2e-on-vitest.md)). No CI.
- **Signed receipts and self-facilitation** ([ADR 0013](adr/0013-signed-receipt.md), [ADR 0014](adr/0014-self-facilitation-fallback.md)): deferred.
- **Web playground.** Dropped for the hackathon; the e2e suite (`e2e/`, also on devnet) plays the agent's role.
- **Observability.** Logs only; no metrics or alerting beyond `/health`.
- **Home redirect on a failed session read.** A network or 5xx error on `/api/me` uses up the one-shot home redirect; only a 200 or 401 should.
- **Home redirect flag.** The redirect flag is a module-level `let` read during render; move it to a ref or a router-level decision.
- **Home redirect placement.** The home redirect lives in `landing/`; it belongs in a `HomeRedirect` element in `routes.tsx`, next to `FirmJobsRedirect`.
- **Role picker.** A wallet with several roles always lands on the firm cabinet; it needs a role picker.
- **Push re-detect.** The web re-reads and re-posts this device's push subscription on every Board or Wallet mount; once per app session is enough.
- **Push log text.** A failed push logs the push service's body or error message, which AGENTS.md's logging rule (public keys, signatures, ids only) does not allow; reduce it to a status and a known reason code.
- **Memo guard trust.** The resend guard accepts any successful transaction that touches the hold wallet and carries `hr:<taskId>` (`src/chain/memo.ts`), so a third party can make a dropped payout look confirmed. Accept only a transaction signed by the hold wallet with the expected transfers; needs an ADR (amends 0006, 0039).
- **Second payment for an orphaned draft.** The draft read reports `orphaned` (ADR 0042), but the pay route and `/unsigned` still accept a payment for that draft. Refusing it changes a payment rule; needs an ADR.
- **429 match in the send phase.** `src/chain/errors.ts` treats any `429` in the error text as retryable, so an ambiguous error whose text contains it would be re-signed (hypothesis, not seen). Anchoring the match changes a retry rule; needs an ADR (amends 0041).
- **Resend on a real chain.** The ADR 0006 resend path is exercised only by the devnet e2e run; on localnet the young hold wallet always gives `uncovered`.
- **Egress guard self-check.** The e2e egress check passes on an empty log even if the guard was not installed; add a deliberate blocked connect.
- **Stale e2e processes.** Detached gateway, MCP and validator children survive a crashed Vitest; needs a pid file and a stale-process kill.
- **Devnet firm keys.** The devnet e2e firm keys live only in memory, so a crash strands their funds; writing them to disk is an owner decision.
- **Orphans before ADR 0042.** Orphans recorded before the migration have no draft id, so their drafts still read as unpaid.
- **File size.** `web/public/agent/sign.mjs` (~276 lines, ADR 0040 allows a split) and several test and support files are over ~100 lines.
