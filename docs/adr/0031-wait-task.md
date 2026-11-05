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
  - It returns on the first change of a fingerprint: the draft state plus each language's `publicState`, including `open -> claimed`. A change only to `paying_out` or `refunding` does not wake Claude: it follows a decision within seconds and `paid_out` or `refunded` comes next. The answer is a `changes` line (for example `de: claimed -> submitted`), the `get_task` text and the new `seen`. Claude asks about approve or reject only for a language that changed to `submitted`.
  - The baseline is `seen` if given, else the first read. Calling again with the same `seen` is always safe. `post_task` and `get_task` also print `seen`, so no change between two calls is lost.
  - It returns at once when every language is paid out or refunded.
  - It sends `notifications/progress` every 30 s when the request carries a `progressToken`.
  - Cap 60 min. On the cap it returns "still waiting" with the unchanged `seen`.
  - Each gateway read times out after 10 s; after an abort the read in flight finishes or times out, then polling stops. A failed read does not end the wait: it keeps polling, and returns an error with the last `seen` once reads have failed for 30 s (enough for a gateway redeploy; at most about 34 s with hung reads). The gateway's own HTTP 404 `{error: "not_found"}` (expired or unknown draft) ends it at once; any other 404, such as a proxy's during a redeploy, is retried. A timed-out read is reported as "gateway did not answer in 10 s".
  - It stops polling when the call is aborted (Esc, `/tasks` stop, a dropped connection).
- The tool descriptions give one start rule: start a `wait_task` only if none is running for this draft in this conversation, with the latest `seen` (from `post_task`, `get_task` or the last `wait_task`), and end the turn while it waits.
- When a language changed to `submitted`, Claude asks the user and ends its turn without a new `wait_task`, then starts one after `approve_task` or `reject_task`. Claude's text shows only when its turn ends, and a new call would hold the turn in the foreground for up to 2 min (seen in a manual Claude Code run, 2026-11-05). Changes made while the user decides are reported by the next `wait_task` through `seen`.
- `get_task` and `wait_task` print the linguist's result as a JSON string on one line, marked as data, so the text cannot fake tool lines such as `seen:` or the settled message.
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
- `mcp/types.ts` mirrors the gateway's `PublicState`. An unknown state fails the whole order parse, so both enums change together.
- A transfer that ends `failed` keeps its language in `paying_out` or `refunding` until an operator requeues it (ADR 0017), so the wait does not settle and returns at the cap.
