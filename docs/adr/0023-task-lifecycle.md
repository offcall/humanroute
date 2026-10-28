# ADR 0023: Task lifecycle: claim, timers, approve/reject with reason, memos

## Status

Proposed

## Context

v1 had one expert, one SLA timer and two outcomes (ADR 0003). In v2 an order creates N `open` tasks (ADR 0022) that linguists of any agency may claim, a firm approves or rejects, and unclaimed or late tasks must be refunded. Claims race between linguists, and decisions race with the timers, the same race ADR 0005 solved for jobs.

## Decision

- `tasks.state`: `open -> claimed -> submitted -> approved | rejected`, plus refund outcomes `open -> expired_unclaimed` and `claimed -> expired_late`. The state is the decision only; money progress is in `transfers` (ADR 0003 split kept).
- Claim: first claim wins by one guarded `UPDATE tasks SET state = 'claimed' ... WHERE id = ? AND state = 'open' AND claim_deadline > now`; zero rows returns `409 claim_taken` or `409 claim_closed`. Only linguists with the task's language pair may claim.
- The claim snapshots the linguist and agency wallets on the task row, next to the refund wallet from the order, so `payouts` needs only `tasks` (ADR 0019).
- Timers are absolute deadlines on the row: `claim_deadline` set at order creation, `work_deadline` set at claim (values per ADR 0028). Every guarded `UPDATE` compares against them, so a late action cannot beat the sweep.
- Submit: claimer only, `{result}` non-empty, `submitted` only before `work_deadline`.
- Approve: owner firm only, from `submitted`.
- Reject: owner firm only, from `submitted`, body `{reason}` non-empty, at most 1000 chars, stored on the task; otherwise `422 reason_required`.
- Memos of the one outgoing transfer per task:
  - `approved`: `hr:<taskId>` (split payout, ADR 0024)
  - `rejected`: `hr:<taskId>:rejected` (full refund to the firm)
  - `expired_unclaimed`: `hr:<taskId>:unclaimed`
  - `expired_late`: `hr:<taskId>:late`
- Per ADR 0005, the decision `UPDATE` and the `pending` transfer row are written in one SQLite transaction. `tasks` exports the guarded updates; `payouts` runs them inside its transaction and inserts the transfer.
- The sweep that refunds unclaimed and late tasks lives in `src/payouts`, not `src/tasks`; `tasks` only exposes read-only selectors and the guarded updates.

## Alternatives

- Sweep in `tasks`: `tasks` would write `transfers` or import `payouts`, a cycle (ADR 0019).
- Relative timers computed in memory: lost on restart.
- Optional reject reason: the firm's reject rate and the agency rating need a stated cause (ADR 0025).

## Consequences

- At most one decision and one transfer per task, enforced by SQLite.
- `tasks` never imports `payouts`: the approve and reject routes get the decision-plus-transfer write from `payouts` through `http` composition, wired by `src/index.ts`.
- A late submit returns `409 late` (api.md).
