# ADR 0021: Firms, Agencies, Linguists and Invites

## Status

Proposed.

## Context

Demo steps 1-3: a firm registers and gets an MCP connection for Claude Code; an agency registers and shares one invite link; a linguist opens the link, signs in and sets language pairs. Linguists see only tasks in their languages. Identity is a wallet signed in by ADR 0020.

## Decision

The `accounts` slice owns these tables:

| Table | Columns | Rule |
|---|---|---|
| firms | id, wallet UNIQUE, name, created_at | one firm per wallet |
| agencies | id, wallet UNIQUE, name, created_at | one agency per wallet |
| linguists | id, wallet UNIQUE, agency_id FK, created_at | one agency per linguist |
| invites | code PK, agency_id UNIQUE FK, created_at | one permanent code per agency |
| linguist_languages | linguist_id, source_lang, target_lang; PK all three | language pairs |
| mcp_tokens | token PK, firm_id UNIQUE FK, created_at | one token per firm |

- Ids are random UUIDs. Invite code and MCP token are random bytes, base64url.
- The firm and its MCP token are created in one transaction. The MCP server (ADR 0027) resolves a token to a firm through `accounts`.
- Linguists hold `agency_id` directly; ADR 0019's `memberships` table is not created.
- Agency languages ("optional" in the demo) are not stored.
- Language pairs are replaced as a whole: 1..10 pairs, lowercase codes, source != target, duplicates dropped.

HTTP (cookie session from ADR 0020; errors `401`, `403`, `404`, `409`, `422`, body `{error}`):

- `POST /api/firm {name}` -> `201 {firm, mcp: {url, token}}`; `409` if the wallet already has a firm.
- `GET /api/firm` -> `{firm, mcp: {url, token}}`; `404` if none. `url` is `MCP_PUBLIC_URL`.
- `POST /api/agency {name}` -> `201 {agency}`; `409` if exists.
- `GET /api/agency` -> `{agency, inviteUrl | null}`.
- `POST /api/agency/invite` -> `{code, url}`; idempotent, `url` is `PUBLIC_BASE_URL/join/<code>`.
- `POST /api/linguist/join/:inviteCode` -> `{linguist, agency}`; idempotent for the same agency, `404` unknown code, `409` already in another agency.
- `PUT /api/linguist/languages {pairs: [{source, target}]}` -> `{pairs}`.

`accounts` exports lookups for other slices: firm by MCP token or id, linguist by wallet with its agency wallet (claim snapshot, ADR 0019), and linguist pairs (board filter).

## Alternatives

- `memberships` (a linguist in several agencies): more tables and a choice of agency at claim; the demo has one agency.
- One invite per linguist, with expiry or revoke: not needed for the demo.

## Consequences

- No linguist list in the agency cabinet, no linguist removal, no token rotation, no profile edits: roadmap only.
- ADR 0019's table list for `accounts` changes (`memberships` dropped); the coordinator updates it.
- Config needs `PUBLIC_BASE_URL` and `MCP_PUBLIC_URL`.

Decided (2026-10-28): MCP token stored in plaintext and shown in the cabinet on every visit (devnet; a task still needs the firm's own payment signature); one agency per linguist, no `memberships` table.
