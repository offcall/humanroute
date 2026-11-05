# ADR 0032: Indigo web UI: theme, CSS layout, client routes

## Status

Accepted. The "No deeplink sign-in" sentence is superseded by ADR 0034.

## Context

The demo video shows every web screen: landing, Connect Claude, pay, the linguist board, translate and submit, the firm jobs overview, review one by one, task detail, agency and join. Today the web has one 76-line `styles.css` that paints every `<button>` blue and caps `#root` at 600 px, and the router matches `/firm` and `/linguist` exactly. The Indigo design (owner, 2026-11-05) has two layouts per cabinet, Ticket and Big; the owner chose Big for the firm and the linguist. ADR 0026 owns the stack (React + Vite, hand-written router, polling, PWA manifest only) and stays.

## Decision

- Theme: Indigo tokens as CSS custom properties (`--hr-*`), paper background, indigo (`#4930C9`) only for "your move" (actions, review). One layout ships: Big (`.theme-big`). Ticket is not built.
- CSS layout: `web/src/shared/styles/` holds tokens, base, type, layout, buttons, forms, status, people, money, alerts and motion files, joined by `styles/index.css`, which `main.tsx` imports. Page and component CSS sits next to its component and is imported by it (`linguist/board-big.css`, `firm/table.css`, `pay/pay.css`, ...). Class names keep the mock names. Every CSS file is Biome-formatted and stays <= ~100 lines, like TS files. `shared/styles.css` is deleted.
- Client routes (prefix matching in `shared/router.ts`, no router library):
  - `/firm` redirects to `/firm/jobs`; `/firm/jobs`, `/firm/jobs/:orderId/:lang` (task detail), `/firm/review`;
  - `/linguist` (board), `/linguist/tasks`, `/linguist/tasks/:taskId`, `/linguist/wallet`;
  - `/`, `/agency`, `/join/:code`, `/pay/:draftId` unchanged.
  The gateway's SPA fallback (ADR 0026) already serves them; no server change.
- Polled lists that a finger acts on keep a snapshot: the linguist board shows new jobs in a banner and applies them on tap; the firm review queue is fixed on entry and only appends. A task decided elsewhere (for example from Claude, ADR 0030) leaves the queue on the next poll, and `409 bad_state` reads "Already decided (maybe from Claude)".
- Countdowns share one 1 s clock with the server offset; a separate polite live region announces only at 60 / 30 / 10 s.
- Languages: the web adds `ru` to its language list; the server already accepts any `^[a-z]{2}$`.
- PWA: `theme_color` and `background_color` are the Big paper tone; the icon is an indigo rounded square with a white "HR" (SVG, 192, 512, maskable 512, apple-touch 180). Rendered once outside the repo, committed as files; no new dependency.
- Phantom: the installed PWA has no injected provider, so the video is recorded in Phantom's in-app browser. No deeplink sign-in.

## Alternatives

- Ship both layouts: about +15 h for a second board, task list, jobs list and headers.
- Keep one global stylesheet: thousands of lines after Biome formatting, against the ~100-line rule.
- A router library: still not needed for nine routes (ADR 0026).

## Consequences

- About 20 CSS files; unused Ticket CSS never enters the bundle.
- Removing the global button rule restyles every page at once, so every page is restyled in this plan.
- New paths are listed in `docs/design/api.md` "SPA routes".
- Fields the design shows but the API does not have come from ADR 0033 or are hidden, never sample values.
