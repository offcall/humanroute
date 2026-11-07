# ADR 0045: The Cabinet Waits for the Auto-Pay Transaction Through the Gateway

## Status

Proposed.

## Context

ADR 0036: the firm signs and sends approve and revoke with Phantom. The cabinet then re-read `GET /api/firm/autopay` once, 4 s later. When devnet had not reached the gateway's commitment by then, the card stayed OFF with no further read. The firm went through setup again and signed a second, needless approve.

## Decision

- New `POST /api/firm/autopay/confirm` (cookie, firm), body `{signature}`: a base58 64-byte transaction signature.
- The gateway polls `signatureStatus` once a second, up to 30 times, at its configured commitment. An unseen or pending signature and a chain read error are retried. The wait stops when the caller disconnects.
- Confirmed: `200` with the same body as `GET /api/firm/autopay`, read after the confirmation. Failed on chain: `409 {error: "tx_failed", message}`. Not confirmed in time: `504 not_confirmed`. Bad body: `422 invalid_signature`.
- The route only reads chain; nothing is signed or sent. The signature is not tied to the firm: a foreign signature only makes the firm wait for someone else's transaction and then read its own account.
- The cabinet calls it right after Phantom returns the signature, keeps the buttons busy while it waits, and shows the returned state. The timer is removed.

## Alternatives

- The browser polls the gateway or confirms the signature through a devnet RPC itself: guesswork on timing, or an RPC endpoint and its rate limits in the browser.
- Show ON before confirmation: can show ON for a transaction that failed.

## Consequences

- One request holds a connection for up to ~30 s; a proxy timeout must allow it.
- `OrdersDeps` gets `signatureStatusOf`, wired from the chain client's `signatureStatus`.
