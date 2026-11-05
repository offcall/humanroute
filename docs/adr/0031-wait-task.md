# ADR 0031: wait_task with progress notifications

## Status

Proposed

## Context

ADR 0027 has no `wait_task`: Claude learns about an order only by calling `get_task` again. The turn ends, and the user has to type "check again". A linguist claims and submits minutes later (ADR 0028), and the owner wants Claude to react within seconds and keep reacting without the user's help. The MCP server stays remote, stateless Streamable HTTP (ADR 0027).

Claude Code (checked on 2.1.318, 2026-11-05):

- aborts an HTTP tool call after 5 min with no response and no progress notification; progress resets that idle window;
- moves a call that runs past 2 min to the background, frees the chat, and wakes Claude when the result arrives.

A stateless server on SDK 1.32.2 streams progress notifications on the POST response.

## Decision

- MCP tool `wait_task {draftId, seen?}`:
  - `mcp/` polls the gateway every 2 s, using the same two reads as `get_task`.
  - It returns on the first change of a fingerprint: the draft state plus each language's `publicState`, including `open -> claimed`. The answer is the `get_task` text plus the new `seen`.
  - The baseline is `seen` if given, else the first read. Calling again with the same `seen` is always safe.
  - It returns at once when every language is paid out or refunded.
  - It sends `notifications/progress` every 30 s when the request carries a `progressToken`.
  - Cap 60 min. On the cap it returns "still waiting" with the unchanged `seen`.
  - It stops polling when the call is aborted (Esc, `/tasks` stop, a dropped connection).
- The tool descriptions tell Claude to call `wait_task` after `post_task` and after every result, and to end its turn while it waits.
- Supported client: Claude Code connected directly with `claude mcp add --transport http`. claude.ai connectors are not supported: their proxy cuts a call at about 240 s.
- The gateway is unchanged.
- This supersedes the "No `wait_task`" rule of ADR 0027.

## Alternatives

- Gateway long-poll or event bus: a new module coupling (ADR 0019) for less than 2 s of latency.
- MCP Tasks: needs SDK 2.x and protocol 2026-07-28. They are in beta, CLI only and behind a feature flag.
- Channels: stdio only, a local process, research preview.
- `/loop` or cron in the session: a model turn per tick, at least a minute of latency.

## Consequences

- Each waiting call holds one long SSE response through Traefik. Coolify's compress middleware must not buffer it on `/mcp` (`gzip-sse`).
- A redeploy drops waiting calls. Claude calls again with `seen`.
- A background call does not survive exiting Claude Code. The order state stays in the gateway, so a new session calls `wait_task` again.
- Every wake-up costs one model turn, including `claimed`.
