# ADR 0036: Agent auto-pay through an SPL delegate

## Status

Accepted

## Context

Today a human pays every order: MCP `post_task` returns a pay link and the firm signs one x402 payment in Phantom (ADR 0027). The owner wants the agent (Claude Code or another terminal agent) to sign the order payment itself and report "I signed". The MCP server stays remote; the gateway and the MCP server must not hold the firm's key; the money stays in the firm's own Phantom wallet; the payment stays x402 `exact` on Solana devnet.

`@x402/svm` 2.28.0 facts this rests on: the facilitator's static path checks the layout `[SetComputeUnitLimit, SetComputeUnitPrice, TransferChecked, Memo?]`, mint, destination = ATA(payTo), amount, and simulates. It does not check that the TransferChecked authority owns the source account, so an SPL delegate can be the authority. The reported `payer` is that authority. A devnet spike (2026-11-05) settled a delegate-signed payment through x402.org; a second payment over the allowance failed in simulation.

## Decision

- Allowance: the firm signs SPL `ApproveChecked` in Phantom in the firm cabinet: "agent key X may spend up to N USDC from my USDC account". `Revoke` turns auto-pay off. A new approve replaces the old delegate and amount (one delegate per token account). The cap is total, not per period, and is enforced on-chain. Phantom signs and sends both; the firm pays the SOL fee.
- Agent key: a Solana keypair file on the firm's machine, `~/.humanroute/agent-key.json`, mode 600. The cabinet shows a command that downloads `setup.mjs` from the gateway and runs it with Node; it writes the key and `sign.mjs` (Node built-in `crypto` only) and prints the public key. The gateway never stores the agent key; it reads the delegate from the firm's USDC token account on-chain.
- Payment flow:
  - Creating a draft returns `autopay: "available" | "unavailable" | "unknown"` in the authenticated `POST /api/orders/draft` response only. The gateway reuses the unsigned payment's delegate, allowance and balance checks for the draft total. No token account, no delegate, insufficient allowance or insufficient USDC means `unavailable`; an RPC failure, exception or read taking longer than 2 s means `unknown`. Neither prevents a successful draft response. No transaction or blockhash is prepared. Public draft reads do not expose this field or read the chain.
  - This is a snapshot, not permission to spend or proof that the agent has the delegate's local key. `prepare_payment` checks the chain again before building a payment. An older gateway without the field is treated as `unknown`; an invalid field fails MCP parsing.
  - Claude first shows the pay link. If the user already chose to pay by link, Claude starts `wait_task` immediately without an auto-pay question. Otherwise Claude asks "I'll pay N USDC, ok?" only for `available`, then starts `wait_task` immediately without waiting for the user's answer. For `unavailable` or `unknown`, Claude gives the link and waits without offering auto-pay. It never asks the user to report that payment completed.
  - If the user already instructed Claude to pay, Claude proceeds to `prepare_payment`, signing and `pay_task` before starting a wait; it does not ask again, even if the snapshot was unavailable or unknown. If the user requests auto-pay while a wait is running, Claude performs the payment and leaves that wait running. A second wait for the same draft must not start; after one returns, Claude continues with the latest `seen` (ADR 0031).
  - MCP `prepare_payment {draftId}`: MCP asks the gateway's own `402` for the payment requirements, then `POST /api/orders/draft/:draftId/unsigned` (MCP Bearer) with the requirements' fee payer. The gateway checks the delegate, allowance and balance and builds the unsigned transaction in the x402 layout: source = the firm's USDC ATA, authority = the delegate, random memo, fresh blockhash. MCP keeps it in memory for 2 minutes and returns the message to sign and the `sign.mjs` command.
  - `sign.mjs` signs only a message with exactly that layout: a TransferChecked of the configured mint from the firm's ATA to the gateway's pay-to ATA with its own key as authority. It prints the amount before signing.
  - MCP `pay_task {draftId, signature}`: MCP checks the ed25519 signature against the stored message, builds the `PAYMENT-SIGNATURE` header from the requirements it got, and posts it to `POST /x/orders/:draftId`. The gateway verifies and settles as today. An expired blockhash means `prepare_payment` again; `draft_paid` means the order is already paid. No answer within 45 s, a broken connection or a 5xx other than `orphan_payment` means the payment may have settled: Claude calls `get_task` and, with no order, tells the user the outcome is unknown and asks before paying again (a settled orphan would otherwise be paid twice). `payment_in_progress` means it is still settling: `get_task`, no new payment. `orphan_payment` means the money was taken without an order: Claude must not pay again.
- Refunds go to the firm's login wallet (`firms.wallet`), not to the x402 payer. This also applies to pay-link payments. `orders.payer` still records who signed (the delegate for auto-pay).
- An orphan payment (ADR 0016) is refunded by hand to the owner of the payment's source token account, checked on-chain; for auto-pay that is the firm, not the delegate.
- Transactions: the gateway builds and the MCP server forwards the payment, the facilitator broadcasts it, and Phantom sends approve and revoke. The gateway still sends only payouts and refunds, from `src/payouts/`.
- The pay link stays available for every draft.
- A definitive refusal before settlement (such as auto-pay off, insufficient allowance or a signing failure) falls back to the pay link and one wait. An unknown payment outcome, `payment_in_progress` or `orphan_payment` keeps the stricter rules above: the link is not an invitation to pay again.
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
- The availability read adds up to 2 s to draft creation. The deadline stops waiting, not the underlying RPC request; a late result is ignored. Availability can change before consent. Client handling of a user's reply while `wait_task` runs in the foreground must be verified in a live Claude Code run.
- Not verified: how Phantom displays the approve prompt.
