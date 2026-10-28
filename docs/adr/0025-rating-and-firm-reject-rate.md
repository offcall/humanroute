# ADR 0025: Rating and Firm Reject Rate

## Status

Proposed.

## Context

Demo step 7: a rejected task lowers the agency's rating. Step 8: the cabinets show the agency rating, the firm's reject rate and the money. Task outcomes live in `tasks` (ADR 0023). The rating slice must not own or duplicate them.

## Decision

- Agency rating = approved / (approved + rejected + late) over tasks claimed by the agency's linguists, as an integer percent, `null` when the denominator is 0.
- Firm reject rate = rejected / (approved + rejected) over the firm's tasks, as an integer percent, `null` when the denominator is 0.
- Unclaimed tasks count for nobody.
- Computed on read through `src/tasks/index.ts` (ADR 0019 edge `rating -> tasks`). `rating` has no tables, no `sql.ts`, no `migrations.ts`. Tasks keep `agency_id` and `firm_id` so outcomes can be grouped.
- HTTP, no session required:
  - `GET /api/rating/agency/:id` -> `{agencyId, ratingPct, approved, rejected, late, paidUnits}`
  - `GET /api/rating/firm/:id` -> `{firmId, rejectPct, approved, rejected, spentUnits, refundedUnits}`
- Money fields are USDC base units as decimal strings (bigint inside). Counts are numbers.
- A bad id format is `422`; an unknown id returns zero counts and `null` percent (no `rating -> accounts` edge).

## Alternatives

- Stored counters updated on approve/reject: second source of truth, needs writes from `tasks`.
- Stars, reviews, weighting, Wilson score, public leaderboard: roadmap.

## Consequences

- Step 8 needs no extra money endpoint: the rating responses carry it.
- Stream A must export task outcomes per agency or firm from `src/tasks/index.ts`.
- The numbers are always consistent with task states; cost is one aggregate query per read.

Decided (2026-10-28): separate public `GET /api/rating/firm/:id`; ratings in percent; unknown id returns zero counts and null percents, no `404`.
