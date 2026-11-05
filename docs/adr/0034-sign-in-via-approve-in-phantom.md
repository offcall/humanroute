# ADR 0034: Sign-in via approve in Phantom

## Status

Proposed. Amends ADR 0019 (auth table) and ADR 0020 (a second way to start a session). Supersedes the "No deeplink sign-in" line of ADR 0032.

## Context

A linguist works on a phone. Safari and the home-screen icon have no injected Phantom provider, so today the cabinet works only inside Phantom's in-app browser: no home-screen session and no push (ADR 0029). The owner rejected any step where the linguist types or compares a code. A device spike (owner's iPhone, iOS 18.7, Phantom 26.37, 2026-11-05) passed: Safari opens a page in Phantom, the user signs and taps "◀ Safari", and the waiting tab picks up its session as soon as it is visible again. The same works from the home-screen icon, and cookies set in Safari are copied into the icon at install.

## Decision

- Login request. The waiting tab (Safari or the icon) calls `POST /api/auth/login-request` with `{}` and gets `201 {id, expiresAt}`. The secret goes only into cookie `hr_login` (HttpOnly, SameSite=Lax, `Path=/api/auth/login-request`, Secure when `PUBLIC_BASE_URL` is https, Max-Age = TTL). The table stores the sha256 of the secret. TTL 2 minutes, a constant in `src/auth`. The tab keeps `id` in `localStorage`.
- "Sign in with Phantom" opens `PUBLIC_BASE_URL/approve/<id>` in Phantom's in-app browser through Phantom's browse deep link.
- `/approve/<id>` shows "Approve only if you just tapped Sign in yourself" and two buttons:
  - Approve: SIWS as in ADR 0020 (`POST /api/auth/nonce`, connect + `signMessage`), then `POST /api/auth/login-request/:id/approve {wallet, nonce, signature}`. The server consumes the nonce, verifies the signature and records the wallet: `UPDATE … WHERE approved_at IS NULL AND rejected_at IS NULL AND expires_at > now`, `changes === 1`. `200 {}` on success; `409` if already approved or rejected; `410` expired or unknown; `401` bad signature. No session is set in Phantom.
  - Reject: `POST /api/auth/login-request/:id/reject {}` → `204`, same conditions and `409`/`410`.
  - After either: "Done, go back to Safari". The page never navigates into a cabinet inside Phantom.
- Claim. The waiting tab calls `POST /api/auth/login-request/:id/claim {}` (JSON, `Cache-Control: no-store`) on load, on `visibilitychange` to visible and every 3 s while visible. The server checks the `hr_login` secret against the row:
  - approved and not consumed: `UPDATE … SET consumed_at WHERE consumed_at IS NULL AND expires_at > now`, `changes === 1` (like `consumeNonce`), then a session exactly as ADR 0020 (`hr_session`, 7 days), `hr_login` cleared, `200 {wallet}`;
  - pending: `202 {status: "pending"}`;
  - rejected, expired, consumed, unknown or a wrong secret: `410 {status: "gone"}`, `hr_login` cleared.
- Join. The login request carries no invite code. A `/join/<code>` tab first gets its session by this flow, then calls the existing `POST /api/linguist/join/:code` itself (ADR 0021).
- `auth` owns the new table `login_requests` (id PK, secret_hash, created_at, expires_at, approved_wallet, approved_at, rejected_at, consumed_at), added by auth migration `0002`. The ADR 0019 table row for `auth` becomes `nonces, sessions, login_requests`. Import edges do not change.
- The existing sign-in inside Phantom's browser (injected provider, ADR 0020) stays.

## Alternatives

- Code matching (the tab and Phantom show the same short code): blocks the phishing case below; rejected by the owner, no code steps.
- Invite code inside the login request, joined on approve: couples `auth` to `accounts`; the waiting tab can join itself.
- Phantom deep-link `connect`/`signMessage` with encrypted redirects: more code and a new crypto dependency; the browse link works on the device.

## Consequences

- Phishing risk, accepted for devnet: an attacker who sends a victim a fresh `/approve/<id>` link gets the victim's session if the victim taps Approve within 2 minutes. The page text and short TTL are the only guards. The linguist wallet only signs in; payouts go to the wallet stored at join, so a stolen session risks claims, submissions and rating, not funds. A production build needs code matching or a wallet-bound flow.
- Phantom asks twice per approve (connect, then sign).
- Phantom has no "Add to Home Screen"; only Safari does, so the install hint shows only in Safari.
- Android is untested (no device).
- Tests are deferred by decision of the owner.
