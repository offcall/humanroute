# ADR 0020: SIWS Sessions and Roles

## Status

Proposed.

## Context

Demo steps 1-3 sign in a firm, an agency and a linguist with Phantom. Each cabinet needs to know which wallet is calling and which roles it holds. The gateway is one process (ADR 0007), devnet only (ADR 0008), and must not add dependencies for this.

## Decision

- Sign-In With Solana with a server-built message. `POST /api/auth/nonce {wallet}` returns `{nonce, message}`. The server builds the SIWS-format text (domain and URI from `PUBLIC_BASE_URL`, address, statement, version 1, nonce, issued-at, expiration) and stores it with the nonce. The message has no Chain ID line: Phantom refuses to sign when it differs from the wallet's network, and sign-in is off-chain. The client signs exactly that text with Phantom `signMessage`.
- Nonce: random, bound to the wallet, valid 5 minutes, single use.
- `POST /api/auth/verify {wallet, nonce, signature}` marks the nonce used, verifies the Ed25519 signature over the stored text with `node:crypto`, and starts a session. The server never parses client-supplied message text. Every failure is `401` with one generic error.
- Session: random 32-byte token in cookie `hr_session` (HttpOnly, SameSite=Lax, Path=/, Secure when `PUBLIC_BASE_URL` is https). The `sessions` table stores only the sha256 of the token. TTL 7 days. Nonce and session TTLs are constants in `src/auth`, not env.
- CSRF: SameSite=Lax, and POST/PUT require `content-type: application/json`.
- Logout: `POST /api/auth/logout` with `{}` (JSON) deletes the session row and clears `hr_session`; `204`. Idempotent. The web header has a "Sign out" button, so one browser can switch roles.
- `auth` owns `nonces` and `sessions` and exports a session lookup (wallet or none). `http` passes it into the routes of other slices (ADR 0019); they do not import `auth`.
- Roles are not stored in `auth`. They are derived from `accounts` (ADR 0021): a wallet is a firm, an agency and/or a linguist if the matching row exists, at most one of each. `GET /api/me` (served by `accounts`) returns `{wallet, firm?, agency?, linguist?}`.
- Errors: `401` no or expired session, `403` wrong role.

## Alternatives

- Phantom `signIn` (client-built message): needs a SIWS message parser and checks on client text.
- JWT or signed cookie: needs a secret and cannot be revoked by deleting a row.
- Embedded wallets or email login (Privy, CDP): new dependency and vendor; Phantom is enough for the demo.

## Consequences

- No new dependency. Ed25519 verify through `node:crypto` on Node 22 is not verified yet; a manual sign/verify check comes first in the build.
- A database leak does not expose live session tokens.
- One wallet can hold several roles; each cabinet checks its own role.

Decided (2026-10-28): session 7 days and nonce 5 minutes, from config (`SESSION_TTL_SECONDS`, `NONCE_TTL_SECONDS`); session lookup is passed in by `http`, no `accounts -> auth` edge.
