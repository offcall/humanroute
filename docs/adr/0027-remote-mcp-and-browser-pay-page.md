# ADR 0027: Remote MCP as a separate process and browser pay page

## Status

Proposed

## Context

Step 4 of the demo needs Claude to post a task to HumanRoute from a chat, and the firm to pay for it from a browser wallet. Today the only client is `agent/`, a script that signs with a local keypair. Claude cannot reach it remotely, and the firm must sign its own payment: the gateway and the MCP server must not hold the firm's key.

## Decision

- MCP server:
  - A separate process in `mcp/`, a second Coolify app.
  - Remote Streamable HTTP transport at `/mcp`, stateless mode.
  - Requests need `Authorization: Bearer <mcpToken>`. One token per firm, stored in the accounts DB in plaintext and shown in the firm cabinet (ADR 0021). The MCP process forwards it to the gateway, which resolves it to the firm.
  - Talks to the gateway only over HTTP.
  - Tools: `post_task` and `get_task`. No `wait_task`.
  - `post_task` never pays. It creates a draft order and returns a pay link to `/pay/:draftId`.
  - `get_task` reads a draft by `draftId`; once paid it returns the `orderId` and the task statuses.
  - The `post_task` description tells Claude to use it for risky medical or drug text.
- Pay page:
  - A React component `PayPage` in `web/src/pay/`, mounted by the SPA router at `/pay/:draftId`. It is part of the same Vite build as the web app, not a separate HTML entry; the gateway serves `index.html` for the route through the SPA fallback.
  - It reads the amount and `payTo` from `GET /api/orders/draft/:draftId`.
  - Wallet: injected `window.phantom` only. Wallet Standard is roadmap.
  - One x402 payment per order, `POST /x/orders/:draftId`; the amount is the sum of the task prices.
  - The browser payment cap is the draft's `totalUnits`. It is enforced through an `x402Client` policy that keeps only payment requirements whose amount equals `totalUnits`; with none left, the payment aborts before signing.
- Import isolation: `mcp/` and `web/` follow the `agent/` rule. They never import `src/` internals; types only via `src/<module>/index.ts` if needed.

## Alternatives

- stdio MCP: runs on the user's machine, not reachable as a remote connector.
- MCP server signs for the firm: needs the firm's key on the server; the firm must sign itself.
- React wallet-adapter or Wallet Standard: heavier than the injected Phantom provider for one page.
- One `MCP_TOKEN` env value: cannot tell firms apart.

## Consequences

- A second process and a second Coolify app to deploy and configure (gateway URL).
- Coordinator needs in the gateway: a draft endpoint (create and read a draft with `totalUnits`, and `orderId` plus task statuses once paid) and the SPA fallback for `/pay/:draftId`; the web router mounts `PayPage` there.
- Claude polls `get_task` itself; there is no blocking wait.
- Only Phantom works on the pay page until Wallet Standard lands.
- Not verified: that the x402 client flow works from a browser with `window.phantom`.
