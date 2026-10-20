# ADR 0012: Deterministic QA

## Status

Proposed (deferred)

## Context

The gateway decides between payout and refund. A judgment call on translation quality would make that decision disputable and non-reproducible. Copying the source or a very short answer is not always an error: names, numbers and short phrases may stay unchanged.

## Decision

- An answer is refunded only for objective failures:
  - empty or whitespace-only answer;
  - answer identical to the source text;
  - extreme length ratio between answer and source (bounds fixed in config).
- Soft signals (language detection, possibly untranslated segments) are advisory flags shown in status; they never trigger a refund.
- The QA verdict is computed in `jobs` inside the claim transaction (ADR 0005), so the new `answered -> refunded` transition (which supersedes part of ADR 0003 when accepted) uses the same path as the SLA refund.

## Alternatives

- LLM judge: non-deterministic and costly; roadmap only.
- No QA: every answer is paid; simplest and the current MVP behavior.

## Consequences

- Deferred: until accepted, every answer submitted before the deadline is released.
- The bounds must be tuned for short inputs to avoid refunding valid identical answers.
