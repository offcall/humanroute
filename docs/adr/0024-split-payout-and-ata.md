# ADR 0024: Split payout in one transaction and ATA creation

## Status

Proposed

## Context

v1 sent one transfer from hold to one expert (ADRs 0003, 0006). In v2 an approved task pays the linguist, the agency and HumanRoute. Several transactions per task would multiply the resend and double-pay cases of ADR 0006. A fresh Phantom wallet often has no USDC token account (ATA), which ADR 0006 treats as a final error.

## Decision

- One outgoing transaction per task: a split payout or a full refund (ADR 0023).
- Payout legs: linguist, agency, fee. Fixed shares in basis points from config: linguist 8000, agency 1800 (`AGENCY_SHARE_BPS`), fee 200 (`FEE_SHARE_BPS`) to `FEE_WALLET`. Each leg is `priceUnits x bps / 10000` in `bigint`; the rounding remainder goes to the linguist. Legs sum to `priceUnits`; a 0-unit leg is skipped.
- Hold minimum SOL in preflight: 0.05 SOL (50_000_000 lamports), to cover ATA rent.
- Refund: one leg, full `priceUnits` to the refund wallet.
- Instruction order in the transaction:
  1. idempotent ATA creation for every recipient whose ATA may be missing, paid by the hold wallet;
  2. one `TransferChecked` per leg, hold ATA -> recipient ATA;
  3. the memo last (ADR 0023 format).
- `transfers` keeps one row per task: `UNIQUE task_id`, `kind` payout or refund, `memo`, and `legs` as typed JSON (`[{role, wallet, units}]`), validated when read back.
- Signing, sending, resending, confirmation and requeue are unchanged (ADRs 0006, 0017). The memo lookup guard matches the row's stored memo.
- Only `src/payouts/` sends; `src/chain` builds and signs the transaction without network access.

## Alternatives

- One transaction per leg: three resend and confirm cycles per task, partial payouts possible.
- Require recipients to create ATAs first: blocks the demo on a fresh wallet.
- Legs as separate rows: breaks "one transfer row per task" (ADR 0003).

## Consequences

- A payout lands for all legs or none.
- A missing recipient ATA is no longer a final error; the hold pays ATA rent (~0.002 SOL each) in SOL.
- Transaction size limits the leg count; three legs plus ATA creation fit.
