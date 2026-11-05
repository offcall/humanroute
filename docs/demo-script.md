# Demo script (3-minute video)

Owner records alone in three windows: browser 1 is the firm cabinet next to Claude Code, browser 2 is the agency cabinet, and the phone is the linguist web app. Wallets are prepared in advance on devnet: the firm has USDC, the hold wallet has SOL. Timers run in `TIMER_MODE=video` (claim 60 s, work 180 s).

Setup before recording: gateway and MCP server running ([README](../README.md)), `FEE_WALLET` set, fresh database.

| Target time | Window | Step | What the viewer sees |
| --- | --- | --- | --- |
| 0:00 | Browser 1 | Open the landing page, click "Register firm", sign in with Phantom (Sign-In With Solana). | Firm cabinet with the MCP URL and token. |
| 0:20 | Terminal | Add the MCP server to Claude Code with the URL and token from the cabinet. | Claude Code lists `post_task`, `get_task`, `approve_task` and `reject_task`. |
| 0:35 | Browser 2 | Register the agency with its wallet, then "Add linguist". | One permanent invite link. |
| 0:50 | Phone | Open the invite link, sign in with Phantom, set EN to ES and EN to FR. | Linguist cabinet with the two pairs. |
| 1:05 | Terminal | Prompt: "A pharmacy chain publishes this drug leaflet in 3 languages, translate it and prepare it for publication." Claude drafts the three translations and calls `post_task`. | Claude returns the pay link. |
| 1:25 | Browser 1 | Open the pay link, sign the single payment with Phantom. | One transaction for the order; the money is on the hold wallet (show the explorer link). Three tasks appear. |
| 1:45 | Phone | Claim the ES and FR tasks on the board. The first claim wins. | Both tasks are "claimed" with countdowns. |
| 2:00 | Phone | Edit Claude's draft next to the original and submit. | Tasks show "submitted". |
| 2:15 | Terminal + Browser 1 | Claude shows both results and asks. The owner answers "approve ES, reject FR: <reason>"; Claude calls `approve_task` and `reject_task` (ADR 0030). The cabinet buttons do the same. | Claude reports both decisions. Cabinet: approve shows "paying out", then "paid out" once confirmed; reject shows "refunding", then "refunded". |
| 2:35 | Browser 1 + explorer | Show the single payout transaction: linguist, agency and fee legs, memo `hr:<taskId>`. | Explorer shows three legs. |
| 2:45 | Browser 2 | Agency cabinet: income and rating (approved, rejected, late). | Rating moves after the reject. |
| 2:55 | Browser 1 | Firm cabinet: reject rate and money totals; the unclaimed third language was refunded with memo `:unclaimed`. | Closing shot of all three cabinets. |

Timings are a plan for the recording, not measured. Keep the video under 3 minutes; the timer presets are config, not code.
