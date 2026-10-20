# ADR 0002: Toolchain

## Status

Accepted

## Context

HumanRoute needs one recorded toolchain for runtime, package manager, language, lint/format, type check and Solana access. The x402 client (`@x402/svm` exact scheme) needs a `@solana/kit` signer, while the gateway's own transfers are simplest with `@solana/web3.js` 1.x and `@solana/spl-token`.

## Decision

- Runtime: Node.js >= 22.12. Code runs through `tsx`; there is no build step.
- Package manager: npm, `package-lock.json` committed.
- Modules: ESM (`"type": "module"`), `module` and `moduleResolution` `NodeNext`, target ES2022.
- TypeScript strict: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`.
- Lint and format: Biome with recommended rules.
- `npm run check` runs `biome check .` and `tsc --noEmit`. It must pass before every commit.
- Solana: `@solana/web3.js` 1.x for every transaction the gateway builds, signs and sends (payout, refund, status, memo lookup). `@solana/kit` is used only where the `@x402/*` client requires a kit `KeyPairSigner` (the demo agent).

## Alternatives

- `@solana/kit` everywhere: one SDK, but more code for SPL transfers and memo lookup now, and it was not verified against our flow.
- Native type stripping instead of `tsx`: fewer deps, but stricter syntax limits; not worth it for this project.

## Consequences

- One command validates a change.
- Two Solana SDKs are installed. This is a deliberate trade-off: kit stays confined to `agent/` and to x402 internals; `src/chain` uses web3.js only. Moving the gateway to kit needs a new ADR.
- Changing any tool needs a new ADR.
