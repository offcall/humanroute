# ADR 0001: Use Architecture Decision Records

## Status

Accepted

## Context

HumanRoute is built by one owner and several coding agents working in parallel. Decisions made only in chats or agent contexts get lost, and the previous implementation (removed in the rewrite; still in git history up to commit `3cd3705`) drifted from its specification because the reasons behind it were never written down.

## Decision

- Record every significant decision as an ADR in `docs/adr/NNNN-kebab-case-title.md`, numbered sequentially.
- Significant: dependencies, toolchain, module boundaries, public interfaces, data formats, persistence, money movement, retry rules.
- A new ADR starts as `Proposed` and may be edited freely; it becomes `Accepted` when the step it describes is accepted.
- An accepted decision is never rewritten. A new ADR supersedes it, and the old one gets status `Superseded by NNNN`.
- Every ADR gets a row in `docs/adr/README.md`.

## Alternatives

- Decisions in README or AGENTS.md only: mixes rules with history and loses the "why".
- No records: every agent re-derives the design from code.

## Consequences

- Decisions stay discoverable in the repo, next to the code.
- Changing the transfer or resend rules (ADR 0005, 0006) requires a new ADR, not a quiet code edit.
