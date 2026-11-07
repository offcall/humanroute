# ADR 0028: Demo vs public timers in config

## Status

Accepted

## Context

The demo video is at most 3 minutes, so an unclaimed task must be refunded within about a minute. Jury members trying the public deployment need more time to claim and translate. v1 had one `SLA_SECONDS` value, removed in v2 (ADR 0019). ADR 0023 needs two windows: claim and work.

## Decision

- `TIMER_MODE` in config: `video` or `public`.
- `video`: claim window 60 s, work window 180 s.
- `public`: claim window 30 min (1800 s), work window 60 min (3600 s).
- `CLAIM_WINDOW_SECONDS` and `WORK_WINDOW_SECONDS` override the preset when set.
- Timers are absolute deadlines on task rows (ADR 0023): `claim_deadline` = order creation + claim window, `work_deadline` = claim + work window. A config change affects only new rows.
- The sweep that refunds expired tasks runs on a tick of at most 5 s, so an expired task is refunded within one tick of its deadline.

## Alternatives

- One window for both: the claim and work phases need very different lengths.
- In-memory timers per task: lost on restart.

## Consequences

- The video and the public deployment run the same code with different env.
