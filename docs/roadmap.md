# Roadmap

Not built in the hackathon version. Each item is a product or architecture change; the demo script never needs them.

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

- **Tests.** Deferred by the owner. The gate is `npm run check`; deterministic unit and gateway tests come later ([ADR 0012](adr/0012-deterministic-qa.md), deferred).
- **Signed receipts and self-facilitation** ([ADR 0013](adr/0013-signed-receipt.md), [ADR 0014](adr/0014-self-facilitation-fallback.md)): deferred.
- **Web playground.** Dropped for the hackathon; `scripts/create-order.ts` plays the agent's role on devnet.
- **Observability.** Logs only; no metrics or alerting beyond `/health`.
- **Push re-detect.** The web re-reads and re-posts this device's push subscription on every Board or Wallet mount; once per app session is enough.
- **Push log text.** A failed push logs the push service's body or error message, which AGENTS.md's logging rule (public keys, signatures, ids only) does not allow; reduce it to a status and a known reason code.
