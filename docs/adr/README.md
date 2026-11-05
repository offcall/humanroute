# ADRs

Format: `# ADR NNNN: Title`, then `## Status`, `## Context`, `## Decision`, optional `## Alternatives`, `## Consequences`. One decision per ADR. An accepted decision is never rewritten; a new ADR supersedes it and the old one is marked superseded. The request flow and failure table live in [`docs/design/flow.md`](../design/flow.md).

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-use-architecture-decision-records.md) | Use Architecture Decision Records | Accepted |
| [0002](0002-toolchain.md) | Toolchain | Accepted |
| [0003](0003-job-and-transfer-model.md) | Job and Transfer Model | Superseded by 0022, 0023, 0024 |
| [0004](0004-payment-identity-and-replay.md) | Payment Identity and Replay | Superseded by 0022 |
| [0005](0005-claim-then-send.md) | Claim Then Send | Accepted |
| [0006](0006-sign-before-send-and-resend-policy.md) | Sign Before Send and Resend Policy | Accepted |
| [0007](0007-sqlite-one-process.md) | SQLite, One Process | Accepted |
| [0008](0008-custody-and-devnet-only.md) | Custody and Devnet Only | Accepted (mint superseded by 0015, refund by 0036) |
| [0009](0009-module-layout.md) | Module Layout | Superseded by 0019 |
| [0010](0010-boundary-validation-without-casts.md) | Boundary Validation Without Casts | Accepted |
| [0011](0011-devnet-e2e-outside-check.md) | Devnet E2E Outside Check | Accepted |
| [0012](0012-deterministic-qa.md) | Deterministic QA | Proposed (deferred) |
| [0013](0013-signed-receipt.md) | Signed Receipt | Proposed (deferred) |
| [0014](0014-self-facilitation-fallback.md) | Self-Facilitation Fallback | Proposed (deferred) |
| [0015](0015-devnet-test-mint-for-the-demo.md) | Devnet Test Mint for the Demo | Accepted |
| [0016](0016-orphan-payments.md) | Orphan Payments | Accepted |
| [0017](0017-operator-requeue-of-failed-transfers.md) | Operator Requeue of Failed Transfers | Accepted |
| [0018](0018-public-job-state-and-payout-progress.md) | Public Job State and Payout Progress | Superseded by 0023 |
| [0019](0019-module-layout-v2.md) | Module Layout v2 | Proposed |
| [0020](0020-siws-sessions-and-roles.md) | SIWS Sessions and Roles | Proposed |
| [0021](0021-firms-agencies-linguists-invites.md) | Firms, Agencies, Linguists and Invites | Proposed |
| [0022](0022-order-one-payment-many-tasks.md) | Order = one payment, many tasks | Proposed |
| [0023](0023-task-lifecycle.md) | Task lifecycle: claim, timers, approve/reject with reason, memos | Proposed |
| [0024](0024-split-payout-and-ata.md) | Split payout in one transaction and ATA creation | Proposed |
| [0025](0025-rating-and-firm-reject-rate.md) | Rating and Firm Reject Rate | Proposed |
| [0026](0026-frontend-react-vite-pwa-hono-static.md) | Frontend stack: React + Vite, PWA manifest, served by Hono | Proposed |
| [0027](0027-remote-mcp-and-browser-pay-page.md) | Remote MCP as a separate process and browser pay page | Proposed |
| [0028](0028-demo-vs-public-timers.md) | Demo vs public timers in config | Proposed |
| [0029](0029-web-push.md) | Web Push for new tasks | Proposed |
| [0030](0030-approve-reject-from-mcp.md) | Approve and reject from MCP after asking the user | Proposed |
| [0031](0031-wait-task.md) | wait_task with progress notifications | Proposed |
| [0032](0032-indigo-web-ui.md) | Indigo web UI: theme, CSS layout, client routes | Accepted (deeplink sign-in superseded by 0034) |
| [0033](0033-indigo-read-fields.md) | Indigo read fields | Accepted |
| [0034](0034-sign-in-via-approve-in-phantom.md) | Sign-in via approve in Phantom | Proposed |
| [0036](0036-agent-autopay-spl-delegate.md) | Agent auto-pay through an SPL delegate | Accepted |
