# ADR 0015: Devnet Test Mint for the Demo

## Status

Accepted. Supersedes the "one mint: devnet USDC" sentence of ADR 0008.


Note (2026-10-20, later the same day): the Circle faucet delivered 20 devnet USDC to the agent wallet and both demo scenarios were repeated on devnet USDC (`README.md`, Devnet run). The decision stands: any 6-decimal mint is accepted and the test mint remains the fallback when no USDC faucet is reachable.

## Context

ADR 0008 fixed one mint: devnet USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. During the spike (`spike/REPORT.md`) the Circle devnet USDC faucet never delivered tokens to the agent wallet, so no payment in devnet USDC was possible. The code already takes the mint from `USDC_MINT` and checks only that it has 6 decimals.

## Decision

- The gateway accepts any 6-decimal SPL mint configured by `USDC_MINT`. Prices and amounts stay `bigint` base units (0.50 = `500000n`).
- The demo uses the fallback SPL test mint `FeyjUFJCsrdmRB7vJQqCtCXTxgKD11DfYqacVDDGRw2c` (6 decimals, classic Token program, mint authority = hold, keypair `keys/test-mint.json`).
- Devnet USDC remains a supported value of `USDC_MINT`; it is not exercised end to end.
- The agent must allow-list a non-default asset in `@x402/fetch` `spendControls.allowedAssets`, otherwise it refuses to pay.
- All other decisions of ADR 0008 (custody, devnet only, `payTo`, payer refund, preflight, `confirmed`) stay unchanged.

## Verification

The spike settled a real x402 payment on devnet with the test mint on 2026-10-20. The settle response `payer`, the paying agent wallet and the on-chain `transferChecked.authority` were the same key (`DBwaYVM1f1ETACMBFgT3UoQJgV5CMCNhPmVLD9myMJLt`). The facilitator `payer` is not cryptographically bound for the server; the on-chain authority is the authoritative value, and it matched.

## Alternatives

- Wait for devnet USDC: blocks the demo on an external faucet.
- Self-minted token with a different decimals count: breaks the 6-decimal amount rules.

## Consequences

- Demo amounts are in the test token, not USDC; it has no value.
- Payment, payout and refund in real devnet USDC are not verified.
- The hold wallet is the test mint authority, so it can fund demo agents with test tokens.
