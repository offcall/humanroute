# ADR 0026: Frontend stack: React + Vite, PWA manifest, served by Hono

## Status

Proposed.

## Context

The v2 demo script shows a firm cabinet, an agency cabinet and a linguist cabinet on a phone. The browser pay page is owned by ADR 0027. v1 renders server-side HTML from `src/http`. The cabinets need wallet sign-in, live task state and countdowns. The gateway is one process (ADR 0007), and ADR 0019 places the frontend in `web/`, served from `web/dist`.

## Decision

- Stack: `web/` is React + Vite + TypeScript strict, with its own `web/tsconfig.json`. Build output is `web/dist`.
- Delivery: the gateway serves `web/dist` with its own Hono handler in `src/http/web.ts` (`readFile` and a MIME map), plus an SPA fallback to `index.html`; `/api`, `/x` and `/health` get a `404` JSON instead. In dev, Vite proxies `/api`, `/x` and `/health` to the gateway on port 4021, so cookies stay same-origin.
- Isolation: `web/` never imports `src/` internals. Response types are declared in `web/src/shared` and produced by parsers.
- Wallet: the injected Phantom provider only, no wallet-adapter library. On mobile, when no provider is found, a deep link opens the page in the Phantom in-app browser.
- Sign-in: Sign-In With Solana. The server builds the message (`POST /api/auth/nonce`), the client signs it, and the server verifies it and sets an HttpOnly session cookie. ADR 0020 owns the session rules.
- Routing: a hand-written router, no router library.
- Amounts: they arrive as decimal strings of base units and are parsed to `bigint`, never `number`.
- Live state: polling every 3 s. No SSE or websocket.
- Countdowns: computed from server deadlines plus `serverTime`, not from the client clock alone.
- PWA: a manifest, icons and `display: standalone`. No offline cache. ADR 0029 adds a push-only service worker.

## Alternatives

- Server-rendered HTML as in v1: wallet signing, polling and countdowns need client code anyway, and three cabinets in string templates are hard to change.
- Wallet-adapter libraries: many dependencies for one wallet the demo uses.
- react-router: a dependency for a handful of routes a small hand-written router covers.

## Consequences

- The coordinator wires static serving and the SPA fallback in `src/http/app.ts` (planned).
- `web/` has its own build and tsconfig; the gateway only serves its output.
- No `src/` imports from `web/`; response shapes are checked at the browser boundary by parsers.
- The linguist installs the cabinet to the home screen, but it needs the network to work.
- Tests are deferred by decision of the owner.
