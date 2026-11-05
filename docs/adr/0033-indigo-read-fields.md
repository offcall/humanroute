# ADR 0033: Indigo read fields

## Status

Proposed

## Context

The Indigo screens (ADR 0032) show the client firm to linguists, the executing agency and translator to firms, payout times ("Paid out today", "Today" on the linguist side), the linguist's own share on the PAID stamp, the agency name on the join screen, and server-based countdowns on the firm side. The data is stored but not returned: `toView` drops `firmId`, `agencyId` and `linguistId`, the transfer view has no time or legs, `GET /api/linguist` has no agency, and an invite can be read only by joining. The owner decided (2026-11-05): firms see "translator #N" only, every linguist with the pair sees the client firm name, the linguist sees their share, and no new column or migration.

## Decision

Read-only additions; no migration, no new table, no MCP change, no new slice edge (`tasks -> accounts` and `orders -> accounts` are allowed by ADR 0019; `transferViewOf` stays in `payouts` and is injected into `tasks`).

- `TaskView` (every route that returns it):
  - `firmName: string`: the ordering firm;
  - `agency: {id, name} | null`: the claimer's agency, null while `open`;
  - `translatorNo: number | null`: the claimer's 1-based rank inside the agency by `linguists.rowid`, null while `open`. Derived on read, no column.
- Board items: `firmName: string`.
- `TaskView.transfer`:
  - `confirmedAt: string | null`: ISO time of a `confirmed` transfer (its `updated_at`; a confirmed row is final), else null;
  - `earnedUnits: string | null`: the linguist leg of a payout, only in the claimer's own views (`GET /api/linguist`, claimer's `GET /api/tasks/:id`, submit); null for refunds and for every other caller.
- `GET /api/tasks/:id` for the owner firm: `executorPairs: [pair] | null`, the claimer's language pairs; null while `open` and for other callers.
- `GET /api/linguist`: `agency: {id, name}` and `translatorNo: number`.
- New public `GET /api/linguist/join/:inviteCode`: `200 {agency: {id, name}}`, `404 not_found` for an unknown code. Like the invite link itself, the code is the secret.
- `GET /api/orders` and `GET /api/orders/:id`: `serverTime` (ISO), as on the board.
- Chain safety: `confirmedAt` and `earnedUnits` are reads of existing `transfers` rows. Nothing here sends, retries or changes a row (AGENTS.md).

## Alternatives

- `linguists.number` column: exact, but a migration for a label (rejected by the owner).
- Linguist display names: not stored.
- `earnedTodayUnits` on the cabinet: "today" would be the server time zone; per-task `earnedUnits` + `confirmedAt` lets the web count the local day.
- "Visible to N agencies", `claimed_at` / `submitted_at` and an order title: not in this scope; the web hides them or uses the first words of the source text.

## Consequences

- Privacy: every linguist whose pairs match an open task sees the client firm name; firms see the agency name and translator number of the claimer. Recorded as accepted by the owner.
- `translatorNo` changes meaning if a linguist is ever deleted or moves agency (neither exists today).
- `docs/design/api.md` lists the fields in the commits that add them; the web parses them at its boundary (ADR 0010).
