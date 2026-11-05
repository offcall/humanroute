# Demo script (3-minute video)

Owner records alone in three windows: browser 1 is the firm cabinet next to Claude Code, browser 2 is the agency cabinet, and the phone is the linguist web app, opened in Phantom's in-app browser. Safari and the home-screen icon also work: "Sign in with Phantom" opens an approve page in Phantom, and the tab gets its session after "◀ Safari" (ADR 0034). Push for new tasks (ADR 0029) is not part of the video. Wallets are prepared in advance on devnet: the firm has USDC, the hold wallet has SOL. Timers run in `TIMER_MODE=video` (claim 60 s, work 180 s).

Setup before recording: gateway and MCP server running ([README](../README.md)), `FEE_WALLET` set, fresh database.

| Target time | Window | Step | What the viewer sees |
| --- | --- | --- | --- |
| 0:00 | Browser 1 | Open the landing page, click "Register firm", sign in with Phantom (Sign-In With Solana). | Firm cabinet (Indigo, ADR 0032): the "Connect Claude" panel with the MCP URL, token and a copy button. |
| 0:20 | Terminal | Add the MCP server to Claude Code with the URL and token from the cabinet. | Claude Code lists `post_task`, `get_task`, `wait_task`, `approve_task` and `reject_task`. |
| 0:35 | Browser 2 | Register the agency with its wallet, then "Add linguist". | Agency plate and one permanent invite link with Copy. |
| 0:50 | Phone | Open the invite link (the invite shows the agency name before joining), sign in with Phantom, join, set EN to ES and EN to FR in the Wallet tab. | Linguist app: Board, My tasks and Wallet tabs; header "agency · translator #N". |
| 1:05 | Terminal | Prompt: "A pharmacy chain publishes this drug leaflet in 3 languages, translate it and prepare it for publication." Claude drafts the three translations and calls `post_task`. | Claude returns the pay link. |
| 1:25 | Browser 1 | Open the pay link, sign the single payment with Phantom. | Pay page: one big total and a row per language. One transaction for the order; the money is on the hold wallet (show the explorer link). Firm jobs overview: USDC in escrow and three open tasks with auto-refund countdowns. |
| 1:45 | Phone | Claim the ES and FR tasks on the board (big countdown, client firm name, Claim). The first claim wins; new jobs wait behind a "N new jobs" banner. | Both tasks are "claimed" with countdowns; the firm table shows the agency and "translator #N". |
| 2:00 | Phone | Open the task, edit Claude's draft under the source and submit. | Tasks show "submitted"; the firm sees "2 translations wait for your review". |
| 2:15 | Terminal + Browser 1 | Claude shows both results and asks. The owner answers "approve ES, reject FR: <reason>"; Claude calls `approve_task` and `reject_task` (ADR 0030). The cabinet buttons do the same. | Claude reports both decisions. The firm cabinet follows without a reload: approve shows "paying out", then "paid out" with a PAID stamp; reject shows "refunding", then "refunded". Review one by one in the cabinet does the same; a task already decided from Claude leaves the queue. Task detail shows the executing agency, its rating and the payout tx. Phone: My tasks shows PAID with the linguist's share (+0.40). |
| 2:35 | Browser 1 + explorer | Show the single payout transaction: linguist, agency and fee legs, memo `hr:<taskId>`. | Explorer shows three legs. |
| 2:45 | Browser 2 | Agency cabinet: income and rating (approved, rejected, late). | Rating moves after the reject. |
| 2:55 | Browser 1 | Firm cabinet: reject rate and money totals; the unclaimed third language was refunded with memo `:unclaimed`. | Closing shot of all three cabinets. |

Timings are a plan for the recording, not measured. Keep the video under 3 minutes; the timer presets are config, not code.
