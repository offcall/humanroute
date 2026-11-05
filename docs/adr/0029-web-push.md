# ADR 0029: Web Push for new tasks

## Status

Proposed. Amends the "no service worker, no push" line of ADR 0026. Builds the optional `notify` slice of ADR 0019.

## Context

A task waits for a claim only for the claim window (ADR 0028). A linguist on a phone does not keep the cabinet open, so tasks expire unseen. With ADR 0034 the linguist has a session in Safari and in the home-screen icon. iOS 16.4+ delivers Web Push only to a web app added to the home screen from Safari. iPhone users in the EU are not a target (owner, 2026-11-05).

## Decision

- Dependency `web-push` (+ `@types/web-push`) for VAPID and payload encryption (owner, 2026-11-05).
- Config: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` or `https:`), validated in `src/config`. All three or none; a partial set is a startup error. With none, push is off: the server sends nothing and the push card is hidden.
- `notify` owns `push_subscriptions` (endpoint PK, linguist_id, p256dh, auth, created_at) and imports only `store`, `config` and `accounts`, as in ADR 0019. Routes, with the session lookup passed in by `http`:
  - `GET /api/push/key` → `{publicKey: string | null}`;
  - `POST /api/push/subscribe {endpoint, keys: {p256dh, auth}}` → `204`; linguist role required (`401`/`403`); upsert by endpoint, so one device belongs to the last linguist who subscribed on it, and a linguist may have several devices;
  - `POST /api/push/unsubscribe {endpoint}` → `204`, idempotent. Before logout the web unsubscribes this device and calls this route.
- Trigger: `OrdersDeps.onTasksCreated(tasks)` with each task's id, language pair and claim deadline. `orders/settled.ts` calls it after the order is committed, fire-and-forget; an error is only logged and never changes the `201`. `src/wiring` connects it to `notify`; `orders` never imports `notify`.
- Recipients: every linguist with the task's language pair (a task has no agency before claim), all their subscriptions. One push per task and subscription.
- Payload: JSON `{taskId, source, target, claimDeadline}` only, never the source text or the price. Push `TTL` = the claim window in seconds, urgency `high`. A `404` or `410` answer deletes that subscription; other errors are logged with the task id.
- Service worker `web/sw/sw.ts`: TypeScript with its own tsconfig (`lib: WebWorker`, no `as`), built to `/sw.js` with scope `/`. Handlers: `push` (shows "New task <source>→<target>" with the deadline) and `notificationclick` (focuses or opens `/linguist`). No `fetch` handler, no cache; the app still needs the network (ADR 0026).
- Web: a push card in the linguist cabinet asks for permission only on a tap. It is hidden when the key is null, the browser lacks Push, or on iOS outside the home-screen icon.

## Alternatives

- Telegram bot: a second identity and a bot token; the owner chose Web Push.
- Hand-written VAPID and aes128gcm: less dependency, more crypto code to get right.
- Push per agency: a task has no agency until claim.

## Consequences

- iOS: works only in the home-screen icon, iOS 16.4+, after a tap grants permission. Android is untested (no device).
- The demo video does not depend on push; it is shown only if it works on the day.
- A lost push is harmless: the board polls (ADR 0026).
- Tests are deferred by decision of the owner.
