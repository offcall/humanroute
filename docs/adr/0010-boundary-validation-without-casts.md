# ADR 0010: Boundary Validation Without Casts

## Status

Accepted

## Context

HumanRoute moves money based on external data: request bodies, base64 JSON x402 headers, facilitator and RPC responses, env variables and keypair files. A cast like `as SettleResponse` turns a malformed response into a wrong refund address or amount at runtime.

## Decision

- Every external input is parsed at the boundary by a hand-written parser that returns a typed value or an error: request body, `PAYMENT-SIGNATURE` and `PAYMENT-RESPONSE` headers, facilitator `/supported` and settle responses, RPC results, env, keypair files.
- Inside `src/`, values are typed by construction. No `as` casts, no `any`, no non-null `!`.
- Parsers check shape, ranges and formats (base58 public keys, decimal strings for amounts converted to `bigint`, CAIP-2 network id).
- A parse failure maps to a clear response: `422` for the request body, `402` or `400` for payment headers, `503` for facilitator or preflight failures, startup exit for config.

## Alternatives

- Schema library (zod, valibot): less code, but another dependency; the number of inputs is small.
- Trust SDK types: SDK types describe intent, not what arrived over the wire.

## Consequences

- More small parser files, each easy to read.
- Type errors cannot hide behind casts; `tsc` and Biome enforce the rule.
