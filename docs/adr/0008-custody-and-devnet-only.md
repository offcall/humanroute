# ADR 0008: Custody and Devnet Only

## Status

Accepted. The mint sentence is superseded by ADR 0015. The refund sentence is superseded by ADR 0036 (refunds go to the firm's login wallet).

## Context

The x402 exact scheme settles immediately to `payTo`; it has no hold, payout or refund. HumanRoute adds those in the gateway. An escrow program or multisig is out of hackathon scope. The facilitator does not create the recipient token account.

## Decision

- Custodial hot hold keypair, Solana devnet only (`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`), ~~one mint: devnet USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, 6 decimals~~ (superseded by ADR 0015: any 6-decimal mint from `USDC_MINT`).
- `payTo` = hold wallet public key. Its USDC associated token account is created in advance by `scripts/`.
- Payout goes to the expert's wallet; ~~refund goes to the payer wallet from the settle response (`SettleResponse.payer`): the owner of the source token account, never the facilitator fee payer.~~ (superseded by ADR 0036: refund goes to the firm's login wallet)
- Startup preflight: the hold wallet has SOL for fees and its USDC ATA exists; facilitator `GET /supported` lists our network and scheme. If any check fails, `/x/translate` answers `503` and takes no payment. Note: the server still starts when preflight fails and re-checks every 60 s; invalid config exits 1.
- "Paid out" and "refunded" mean the transfer reached `confirmed` commitment. The UI and README say `confirmed`, not `finalized`.
- Keypair files are read from `keys/`; secret keys are never logged.

## Alternatives

- Escrow program or Squads multisig: non-custodial, but weeks of work; post-hackathon path.
- Refund to a client-supplied address header: extra input to validate and trust.

## Consequences

- The operator controls user funds; README states this plainly. Nothing runs on mainnet.
- If `payer` is missing from a settle response, the job cannot be refunded automatically; `payer` = paying wallet = `transferChecked.authority` was verified on devnet 2026-10-20, see `spike/REPORT.md`. A missing or invalid `payer` is an orphan payment (ADR 0016).
- A refund fails if the payer's USDC account was closed; that is a final error (ADR 0006).
