# ADR 0042: The Draft Read Reports Orphans and Settling

## Status

Proposed. Amends the read side of ADR 0016 and ADR 0022; their decisions stay.

## Context

`GET /api/orders/draft/:draftId` answers `state: "draft" | "paid"`. An orphan (ADR 0016) is stored without its draft id, so a draft whose payment settled without an order reads as an unpaid `draft`. A draft whose payment is settling right now (in-flight lock, `409 payment_in_progress`) also reads as `draft`. After a reload the pay page offers Pay again, and MCP `get_task` and `wait_task` say "not paid yet". The firm may pay twice.

Old clients: the web pay page (`web/src/pay/parse.ts`) and MCP (`mcp/parse.ts`) accept only known `state` values. An unknown value is a parse error: the pay page shows "could not load" without Pay, `get_task` fails, `wait_task` retries and then stops with an error. Neither leads to "pay again".

## Decision

- Migration `0002` of the `orders` slice adds `orphans.draft_id TEXT` (nullable; older rows have none) and an index on it. `recordOrphan` stores the draft id of the request.
- The draft read gets two new `state` values, chosen in this order:
  - `paid`: the draft has an order (unchanged).
  - `orphaned`: an orphan row names this draft, resolved or not. The response adds `payTx` (string, or null when the settle response had none).
  - `settling`: the in-flight lock for this draft is held in this process.
  - `draft`: otherwise.
- An `orphaned` draft does not expire on the read; `draft` and `settling` follow `DRAFT_TTL_SECONDS` as before. The pay route and its draft gate are unchanged.
- The in-flight lock set moves from `capturePayment` to the orders routes, shared by the pay route and the read.
- Pay page: `orphaned` shows no Pay; "Money was taken for this draft, but no order was created. Do not pay again: contact the operator" with the draft id and `payTx` (explorer link when known). `settling` shows no Pay; "A payment for this draft is being settled. Do not pay again" with a Check again button. "Check status" after an unknown outcome also switches to the orphaned view.
- MCP `get_task` and `wait_task` render `orphaned` as "money was taken without an order; do not pay again; tell the user to contact the operator with draftId and payTx", and `settling` as "a payment is being settled; do not pay again". `wait_task` returns at once on `orphaned` and says not to call it again for this draft.

## Alternatives

- A separate field (`orphan: {payTx}`) next to `state: "draft"`: an old client ignores it and offers Pay. Rejected.
- Refuse a new payment for an orphaned draft in the pay route: stronger, but changes the payment rule; left for a separate decision.

## Consequences

- Old clients fail closed on the new states (no Pay, an error), never "pay again".
- `settling` is per process; it is lost on restart, like the lock itself.
- An operator who resolves an orphan does not reopen the draft.
