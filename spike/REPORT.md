# HumanRoute spike report: x402 V2 `exact` on Solana devnet

Date: 2026-10-20. Network: `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` (devnet). Facilitator: `https://x402.org/facilitator`.
This is throwaway code. Nothing was committed, and no keys were regenerated.

## Headline

| Claim | Result |
|---|---|
| x402 V2 `exact` payment of 0.50 to the custodial hold wallet through the x402.org facilitator | **Works**, but with a **fallback test mint, not devnet USDC** (see Deviations) |
| Server reads the settlement tx signature | **Yes**, through both the `onAfterSettle` hook and the `PAYMENT-RESPONSE` header |
| Server reads the payer wallet address | **Yes**: `payer` equals the agent wallet |
| Hold wallet refunds the payer on-chain | **Yes**, reached finalized |
| Facilitator sponsors the fee (agent needs no SOL) | **Yes** |
| Replaying an identical `PAYMENT-SIGNATURE` | **Rejected** (402), no second debit |
| Underpayment of 0.10 | **Rejected** (402) by the server before any facilitator call, no debit |

## Deviations / not verified

- **Asset is NOT devnet USDC.** The agent's devnet USDC balance is still 0: the Circle faucet USDC never arrived at `DBwaYVM1f1ETACMBFgT3UoQJgV5CMCNhPmVLD9myMJLt` (USDC ATA `2d5XnDiGiQGogZ44LPDD1nPK1QnugYddd7MKGYinHo8j` = 0 when this report was written). All payments used the fallback SPL test mint `FeyjUFJCsrdmRB7vJQqCtCXTxgKD11DfYqacVDDGRw2c` (6 decimals, classic Token program, mint authority = hold), with an explicit price of `{asset, amount: "500000"}`. Payment, settlement and refund **in real devnet USDC are not verified**. The server has a `SPIKE_ASSET=usdc` switch (price `'$0.50'` via the x402 default assets) that was never exercised. Also, the client must allow-list a non-default asset in `spendControls.allowedAssets`, otherwise `@x402/fetch` refuses to pay.
- **Replay header is not the step-3 header.** The original `PAYMENT-SIGNATURE` from step 3 was never captured to disk. Step 5 therefore created a fresh header, sent it once (it settled, tx `3QqVHy…`), and then resent the byte-identical header. The replay finding holds, but it was not tested on the original step-3 header.
- **Replay was rejected by the facilitator, not by the server.** The error is `invalid_exact_svm_transaction_simulation_failed`: the facilitator's simulation of the already-landed tx failed. The spike server has no idempotency or replay store of its own. Not verified: whether a replay sent *while the first settle is still in flight* (concurrent) is also rejected.
- **The replay's first payment was not refunded.** After step 5 the hold test-mint ATA holds 500000 (0.50 test token) from tx `3QqVHy…`.
- **Setup tx labels not verified.** The setup signatures below were recovered afterwards with `getSignaturesForAddress`. Which signature is mint creation, ATA creation or mint-to was not checked individually.
- `scripts/setup-wallets.ts` is no longer at `scripts/`. The git index shows it staged as renamed to `old/scripts/setup-wallets.ts`, along with the rest of the old gateway. This spike did not make that change.
- No devnet USDC ATA exists for the payer's refund leg in USDC terms. Only the test-mint refund was exercised.

## Packages (pinned, from package.json)

| Package | Version |
|---|---|
| @x402/core | 2.28.0 |
| @x402/hono | 2.28.0 |
| @x402/svm | 2.28.0 |
| @x402/fetch | 2.28.0 |
| @solana/kit | 8.5.0 |
| @solana/web3.js | 1.99.0 (not 3.x: @solana/spl-token 0.4.15 has a peer dependency on ^1.95.5) |
| @solana/spl-token | 0.4.15 |
| @scure/base | 2.4.0 |
| hono | 4.13.13 |
| @hono/node-server | 2.1.5 |
| tsx (dev) | 4.23.15 |
| typescript (dev) | 5.9.3 |
| @types/node (dev) | 22.20.5 |

## Wallets (devnet)

| Role | Address | Test-mint ATA | USDC ATA (`4zMMC9…DncDU`) |
|---|---|---|---|
| hold (payTo, custodial) | `GA2zTLgnzac8zdr2VZBLC7FchaLJbz3MARnzBRkdUFmr` | `EyqH64PJpw63KdN1j6RJ5haRoXU4rkqKaGNwqc6iyuMW` | `BsxRXD6yG87YVxiDtwgUenq3srB5xV9bjoKq5BMzJ5pF` (exists, 0) |
| agent (payer) | `DBwaYVM1f1ETACMBFgT3UoQJgV5CMCNhPmVLD9myMJLt` | `HXay7Sj7t1R1wWLvNmzDa3nDSPBhxH7GG3aEpwFiKB6U` | `2d5XnDiGiQGogZ44LPDD1nPK1QnugYddd7MKGYinHo8j` (exists, 0) |
| expert | `6jAw1ErYkn589oqf9DCiLhQUA3AAXMhvCALJL88RoqL` | `F9tFnaYaivxe2A6jzRRCTxmn73SLtVRekZrm6t1WnSj8` (not created/0) | `QjFeK5wRKRPsrA4iQXG9giAnsdN6KKQTzxuPFxaakir` (0) |
| facilitator fee payer (x402.org) | `CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5` | – | – |

Balances at the end of step 5: hold 0.48995256 SOL and test 500000; agent 0.5 SOL and test 99500000; expert 0 SOL.

## Transactions

| What | Signature | Result |
|---|---|---|
| Hold USDC ATA creation (13:25:38Z) | [5T3VgMNi…](https://explorer.solana.com/tx/5T3VgMNipc1eqR5B6dWE1YMN8RwGzLdf7rEF1zTZecdMpudJypDSH1HHMc44fdZTfx53AyGHpGXK3QE7fisJp4tZ?cluster=devnet) | ok (only tx on that ATA) |
| Test-mint setup (13:37:05Z) | [46muY1nt…](https://explorer.solana.com/tx/46muY1ntVQAB2yonkBkJZ47mnkT5UayDzoypMYTG1F75hRUwXQ1hW24uNCduqPbVqZKbduUD5MsG1ycVP2jP5Rcs?cluster=devnet) | ok, label not verified |
| Test-mint setup (13:37:06Z) | [4mgbbUN3…](https://explorer.solana.com/tx/4mgbbUN3c8ip77sc2kp3r9T2YaE4Q86niakAvL4ktiL2e74L3ac31boRSGujjY3S6MWnTKqxu6NufqEDqVAw8wZP?cluster=devnet) | ok, label not verified |
| Test-mint setup (13:37:07Z) | [2nLTryK8…](https://explorer.solana.com/tx/2nLTryK8DV39CHHHHCXueLnfkdFbvykk1hcWYefFny3vAPJvysqPpo1UKZp1JrAqDhuKdCoRF5khvNTA4Muewuc6?cluster=devnet) | ok, label not verified |
| Test-mint setup (13:37:08Z) | [4cCmTicj…](https://explorer.solana.com/tx/4cCmTicjQ9E3ZReCMFaNxukF9XTifiLCARXG1jqdeUw6jd8HVUQFTWZ6SEV5wDs9CEZf3Totsv4D7nyAbecXMosM?cluster=devnet) | ok, label not verified |
| Test-mint setup (13:37:09Z) | [4o6inzwJ…](https://explorer.solana.com/tx/4o6inzwJKtG6X4ZYRWmVeeaU3KFQuJ4VGZaYL3JoreuRPmtPLXJQvu26v7SQB4UXRRDhxovhscVsfHjmF17jxQfw?cluster=devnet) | ok, label not verified |
| **x402 payment, step 3** (0.50 agent→hold) | [31R1kGMq…](https://explorer.solana.com/tx/31R1kGMqhUczbBHhgHCKBGCcPEgWprvSyXZYCeVpeHNf5nrnniHqjD8zeSn729KFzEsyp6BieXmBQGXKSJ6SjbKe?cluster=devnet) | slot 513178507, err null, finalized |
| **Refund, step 4** (0.50 hold→agent, memo `hr:spike:<paymentSig>`) | [2nYLzgNM…](https://explorer.solana.com/tx/2nYLzgNMKD68meFmJiQUFb8RaEQfMbMaNdCU5DuSemGPRnqXaEi2hCQXxE8NUnkFeBrmDqeQsdikvMvPWbEL9HQ4?cluster=devnet) | slot 513178813, err null, finalized |
| x402 payment, step 5 replay first send (0.50 agent→hold) | [3QqVHyhm…](https://explorer.solana.com/tx/3QqVHyhmeWxYmbNp4Uurm9MKChet1n4idDZKSFKvnUgzPvhMMqSVRCiEuWDCZyzEVoXdHo1S7k8d3KcQc7BvhFFK?cluster=devnet) | slot 513179103, err null, finalized, **not refunded** |

Full signatures:
- payment (step 3): `31R1kGMqhUczbBHhgHCKBGCcPEgWprvSyXZYCeVpeHNf5nrnniHqjD8zeSn729KFzEsyp6BieXmBQGXKSJ6SjbKe`
- refund (step 4): `2nYLzgNMKD68meFmJiQUFb8RaEQfMbMaNdCU5DuSemGPRnqXaEi2hCQXxE8NUnkFeBrmDqeQsdikvMvPWbEL9HQ4`
- replay first send (step 5): `3QqVHyhmeWxYmbNp4Uurm9MKChet1n4idDZKSFKvnUgzPvhMMqSVRCiEuWDCZyzEVoXdHo1S7k8d3KcQc7BvhFFK`

## Timings

| Measurement | ms | Source |
|---|---|---|
| verify start → settle start (step 3) | 253 | `fixtures/settle.json` |
| facilitator settle call (step 3) | 1048 | `fixtures/settle.json` |
| client round trip incl. 402 + paid retry (step 3) | 1508 | `fixtures/client-output.json` |
| first `getTransaction` poll after settle found it at confirmed | 225 (1 poll) | `fixtures/confirm.json` |
| refund send → confirmed | 810 | `fixtures/refund.json` |
| replay first send (paid request only) / its settle call | 1603 / 1329 | `fixtures/replay.json`, server.log |
| replay second send → 402 | 234 | `fixtures/replay.json` |
| underpay → 402 | 2 | `fixtures/underpay.json` |

`settle` returns only after the tx has landed: the tx was already present at `confirmed` on the first poll.

## Fee sponsorship

The 402 `accepts[0].extra.feePayer` is `CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5`. On-chain, both x402 payments have fee payer `CKPKJWN…` and a fee of 10001 lamports. The tx has two signers, facilitator and agent, and contains ComputeBudget ×2, `transferChecked` and a memo. The agent SOL balance was 500000000 lamports before and after, so **the agent paid nothing in SOL**. The refund is a normal hold-signed tx, and hold paid 5000 lamports.

## How the payer and signature were extracted

1. **`onAfterSettle` hook** on `x402ResourceServer` (server side): `result.payer` and `result.transaction` come straight from the facilitator's settle response.
2. **`PAYMENT-RESPONSE` header**: an outer Hono middleware placed before `paymentMiddleware` reads `c.res.headers.get('PAYMENT-RESPONSE')` after `await next()` and base64-decodes the JSON `{success, payer, transaction, network}`.
3. **On-chain cross-check** (`spike/confirm.ts`): `getParsedTransaction(sig)` shows `transferChecked.authority` = `DBwaYVM1…` (the agent), who is also a signer. Destination = hold ATA `EyqH64…`, amount 500000.

All three sources agree: **payer = `DBwaYVM1f1ETACMBFgT3UoQJgV5CMCNhPmVLD9myMJLt` = the agent wallet.** Note that the facilitator's `payer` is not cryptographically bound for the server. The on-chain `transferChecked.authority` is the authoritative value, and it matched.

## Replay (`fixtures/replay.json`)

The same `PAYMENT-SIGNATURE` was sent twice:
- First send: 200, settled as `3QqVHy…`. Agent test balance 100000000 → 99500000, hold 0 → 500000.
- Second send, byte-identical header: **402** with `error: "invalid_exact_svm_transaction_simulation_failed"` and no `PAYMENT-RESPONSE`. Balances were unchanged (agent 99500000, hold 500000), so there was **no double charge and no second resource delivery**.

The protection comes from Solana itself, since an already-processed signature fails simulation, together with the facilitator's verify step. The spike server keeps no replay state. A production server should still store the tx signature as a unique key.

## Underpayment (`fixtures/underpay.json`)

The client took the server's 402 requirements, changed `amount` to `100000` (0.10), and signed a real payload for that amount. Result: **402 `No matching payment requirements`** in 2 ms. `@x402/hono` compares the payload's `accepted` requirements to the route's own and rejects the mismatch locally, before calling the facilitator. Agent and hold balances were unchanged after 5 s. Not tested: a payload that claims `amount: 500000` in `accepted` but whose signed tx transfers less. In that case rejection would depend on facilitator verify.

## Files

- `spike/server.ts`: Hono + `@x402/hono` server on :4402 (still running in the background, log `spike/server.log`)
- `spike/client.ts`: `@x402/fetch` paying client
- `spike/confirm.ts`: on-chain confirmation and payer cross-check
- `spike/refund.ts`: hold → payer refund with memo
- `spike/replay.ts`: step 5 replay and underpay. It backs up and restores the step-3 `settle.json` and `payment-response.json`, which the server overwrites, and saves the replay's settle as `fixtures/replay-first-settle.json`.
- `spike/fixtures/*`: raw evidence (402, settle, payment-response, confirm, refund, replay, underpay)
- `keys/` (gitignored): hold, agent and expert keypairs plus `test-mint.json`
