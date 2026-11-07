# ADR 0040: Agent Signer Validation and Fee Policy

## Status

Accepted (owner, 2026-11-07)

## Context

Line numbers below refer to `main` at `681c295`.

ADR 0036 lets `sign.mjs` sign only an x402 payment with a fixed layout. The parser in `web/public/agent/sign.mjs` reads lengths and indices without bounds (`readLength` at `:34`, key and instruction loops at `:53`-`:72`), does not check that the whole buffer is consumed (`:73`), and checks only the first data byte of the compute budget instructions (`:94`). It accepts any signer position: a message where the agent key is the fee payer, with an extreme compute unit price, is signed, and the agent's SOL would pay the fee.

The gateway builds the message in `src/orders/unsignedTx.ts:35`: fee payer = the facilitator fee payer from the 402 requirements (`src/orders/unsignedRoute.ts:41`), then SetComputeUnitLimit 20,000, SetComputeUnitPrice 1 microlamport, TransferChecked with the delegate as authority, Memo with 32 random hex characters; v0, no lookup tables. Compiled: header (2, 1, 4), 8 static keys, the agent at index 1, instruction data 5, 9, 10 and 32 bytes, 367 bytes in total (checked locally with web3.js).

## Decision

`sign.mjs` fails closed. It signs only when every rule holds:

- Input: canonical base64 (decoding and re-encoding give the same text), message at most 1,232 bytes.
- Parsing: first byte 0x80 (v0); legacy and other versions are refused. Every compact-u16 is at most 3 bytes and canonical; every length, key index and slice stays inside the buffer; lookup table count 0; the buffer ends exactly after it.
- Signers: header exactly (2, 1, 4) and exactly 8 distinct static keys. Key 0 (fee payer) is not the agent key; key 1 is the agent key, so it signs read-only and its SOL cannot be debited.
- Instructions: exactly SetComputeUnitLimit, SetComputeUnitPrice, TransferChecked, Memo. Every program index is a non-signer key; compute budget and memo instructions have no accounts.
- Compute budget: limit data 5 bytes (tag 2, u32 LE) with limit at most 40,000; price data 9 bytes (tag 3, u64 LE) with price at most 1,000 microlamports per unit. Caps are twice the gateway's limit and 1,000 times its price, far below the facilitator's 5,000,000 cap (`@x402/svm` 2.28.0 `MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS`); worst case priority fee 40 lamports.
- Transfer: program `Tokenkeg…`, exactly 4 accounts = configured source, mint, destination, agent; data 10 bytes, tag 12, amount > 0, decimals 6.
- Memo: data 1 to 64 bytes of valid UTF-8.
- Files: the key file is 64 numbers 0-255 whose second half is the public key of the first; the config has base58 32-byte `source`, `destination`, `mint`.

A refusal prints nothing on stdout, prints `sign.mjs refused: <reason>` on stderr and exits 1. Reasons start with `malformed message:`, `the agent key must not pay the fee`, `compute limit <n> above 40000`, `compute price <n> above 1000`, `this is not a HumanRoute payment for this agent key`, or `bad key or config file:`. Success prints only the base64 signature on stdout, exit 0, as today.

## Alternatives

- Exact match on the gateway's values: an installed `sign.mjs` would break on any gateway tweak.
- No cap because the facilitator pays the fee: the signer cannot trust the message it is checking.

## Consequences

- Amends ADR 0036 ("sign.mjs signs only a message with exactly that layout"); the rest of ADR 0036 stands.
- Code: `web/public/agent/sign.mjs` only, about 60 more lines; it may split the parser into `web/public/agent/message.mjs`, then `setup.mjs` downloads both. Gateway unchanged.
- Tests in `contracts/agent-signer-boundary.test.ts` and `contracts/agent-autopay.test.ts` assert: the gateway's own message is signed; refusal (exit 1, empty stdout, reason prefix) for agent as fee payer, limit 40,001, price 1,001, a truncated buffer, trailing bytes, an out-of-range key index, a non-canonical length, a legacy message, a lookup table, a fifth instruction, a wrong signer count or a wrong destination.
- A gateway that raises its compute values above the caps needs a new ADR and a new `sign.mjs` for every firm.
