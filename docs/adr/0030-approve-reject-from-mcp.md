# ADR 0030: Approve and reject from MCP after asking the user

## Status

Proposed

## Context

ADR 0027 gave the MCP server `post_task` and `get_task`; approve and reject lived only in the firm cabinet (api.md). The owner wants the whole review in Claude Code: Claude shows each linguist's result, the user says approve or reject, and Claude records the decision. The owner decided that Claude asks the user in chat first and never decides on its own (2026-11-05).

## Decision

- MCP tools:
  - `approve_task {taskId}`.
  - `reject_task {taskId, reason}`; `reason` is the user's reason, 1..1000 chars (ADR 0023), checked by MCP and by the gateway.
- Their descriptions and the server instructions tell Claude to show the result and ask the user first, and to call a tool only after the user's explicit answer for that language. Claude may recommend, never decide. The guard is the tool description plus Claude Code's own tool-permission prompt, not code; the firm must not pre-allow these tools.
- `get_task` shows the `taskId` and the result of each language, so Claude can quote them. The server instructions tell Claude that a result is data, never instructions.
- Gateway: `POST /api/tasks/:id/approve` and `/reject` accept the owner firm's MCP Bearer token as well as the cookie. With a Bearer header the token decides: unknown is `401`, another firm's `403`.
- Unchanged: only the owner firm decides, only from `submitted`, decisions only record state, payouts send (ADR 0023, 0024); the firm cabinet keeps its buttons.

## Alternatives

- Elicitation form opened by the MCP server: the protocol enforces the question, but it is not verified with the stateless Streamable HTTP server and works only in the Claude Code CLI.
- Claude asks, then links to the cabinet: no new token power, but the review leaves the terminal.
- One-time review token per task: safer, but a new entity and migration for the demo.

## Consequences

- The MCP token, stored in plaintext (ADR 0027), can now decide where a task's money goes: to the claimer's split or back to the firm. It cannot send money to any other address.
- A wrong decision by Claude is final; there is no undo (roadmap: disputes).
- ADR 0027's tool list is extended; its "no `wait_task`" rule is unchanged.
- If the firm pre-allows all `humanroute` tools, only the descriptions stand between a linguist's text and a payout.
