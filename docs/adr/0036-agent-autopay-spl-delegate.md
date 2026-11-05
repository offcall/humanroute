# ADR 0036: Agent auto-pay through an SPL delegate

## Status

Proposed

## Context

Today a human pays every order: MCP `post_task` returns a pay link and the firm signs one x402 payment in Phantom (ADR 0027). The owner wants the agent (Claude Code or another terminal agent) to sign the order payment itself and report "I signed". The MCP server stays remote; the gateway and the MCP server must not hold the firm's key; the money stays in the firm's own Phantom wallet; the payment stays x402 `exact` on Solana devnet.

`@x402/svm` 2.28.0 facts this rests on: the facilitator's static path checks the layout `[SetComputeUnitLimit, SetComputeUnitPrice, TransferChecked, Memo?]`, mint, destination = ATA(payTo), amount, and simulates. It does not check that the TransferChecked authority owns the source account, so an SPL delegate can be the authority. The reported `payer` is that authority. A devnet spike (2026-11-05) settled a delegate-signed payment through x402.org; a second payment over the allowance failed in simulation.

## Decision

- Allowance: the firm signs SPL `ApproveChecked` in Phantom in the firm cabinet: "agent key X may spend up to N USDC from my USDC account". `Revoke` turns auto-pay off. A new approve replaces the old delegate and amount (one delegate per token account). The cap is total, not per period, and is enforced on-chain. Phantom signs and sends both; the firm pays the SOL fee.
- Agent key: a Solana keypair file on the firm's machine, `~/.humanroute/agent-key.json`, mode 600. The cabinet shows a command that downloads `setup.mjs` from the gateway and runs it with Node; it writes the key and `sign.mjs` (Node built-in `crypto` only) and prints the public key. The gateway never stores the agent key; it reads the delegate from the firm's USDC token account on-chain.
- Payment flow:
  - Claude asks the user "I'll pay N USDC, ok?" unless the user said to pay without asking.
  - MCP `prepare_payment {draftId}`: MCP asks the gateway's own `402` for the payment requirements, then `POST /api/orders/draft/:draftId/unsigned` (MCP Bearer) with the requirements' fee payer. The gateway checks the delegate, allowance and balance and builds the unsigned transaction in the x402 layout: source = the firm's USDC ATA, authority = the delegate, random memo, fresh blockhash. MCP keeps it in memory for 2 minutes and returns the message to sign and the `sign.mjs` command.
  - `sign.mjs` signs only a message with exactly that layout: a TransferChecked of the configured mint from the firm's ATA to the gateway's pay-to ATA with its own key as authority. It prints the amount before signing.
  - MCP `pay_task {draftId, signature}`: MCP checks the ed25519 signature against the stored message, builds the `PAYMENT-SIGNATURE` header from the requirements it got, and posts it to `POST /x/orders/:draftId`. The gateway verifies and settles as today. An expired blockhash means `prepare_payment` again; `draft_paid` means the order is already paid. No answer within 45 s, a broken connection or a 5xx other than `orphan_payment` means the payment may have settled: Claude calls `get_task` and, with no order, tells the user the outcome is unknown and asks before paying again (a settled orphan would otherwise be paid twice). `payment_in_progress` means it is still settling: `get_task`, no new payment. `orphan_payment` means the money was taken without an order: Claude must not pay again.
- Refunds go to the firm's login wallet (`firms.wallet`), not to the x402 payer. This also applies to pay-link payments. `orders.payer` still records who signed (the delegate for auto-pay).
- An orphan payment (ADR 0016) is refunded by hand to the owner of the payment's source token account, checked on-chain; for auto-pay that is the firm, not the delegate.
- Transactions: the gateway builds and the MCP server forwards the payment, the facilitator broadcasts it, and Phantom sends approve and revoke. The gateway still sends only payouts and refunds, from `src/payouts/`.
- The pay link stays available for every draft.
- The MCP server keeps the unsigned transaction in process memory only between `prepare_payment` and `pay_task`; Streamable HTTP stays stateless (ADR 0027). One MCP instance runs on Coolify; after a restart Claude calls `prepare_payment` again.

## Alternatives

- Agent secret key in an MCP header, the server signs: the key transits our server.
- Managed wallets (Coinbase CDP, Privy, Turnkey, Phantom Server SDK, Crossmint): the provider holds the key and our server holds spend credentials.
- Squads spending limits: needs the facilitator's smart-wallet path; post-hackathon.
- Separate funded agent wallet: money leaves the firm's Phantom; later.
- Durable nonce: impossible, the facilitator requires compute budget instructions at index 0 and 1.

## Consequences

- Supersedes the refund-to-payer sentence of ADR 0008 and the refund wallet line of ADR 0022.
- A leaked agent key can spend the remaining allowance to any address until the firm revokes it. A leaked MCP token can create drafts and fetch unsigned transactions but cannot sign.
- A compromised gateway could serve a malicious `setup.mjs`; the damage is bounded by the allowance.
- The blockhash lives about 60-90 s; the firm should pre-allow `node ~/.humanroute/sign.mjs` in Claude Code so no permission prompt delays the signature.
- Works only in agents with a local shell (Claude Code, Codex). claude.ai and ChatGPT stay on the pay link.
- Not verified: how Phantom displays the approve prompt.
