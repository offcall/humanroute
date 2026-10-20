// Auto-refreshing job status page for the demo.
import { TransferStatus } from "../store/index.js";
import { type JobStatus, PublicState } from "./types.js";
import { esc, page, secondsLeft } from "./views.js";

const iso = (millis: number | null): string =>
	millis === null ? "—" : new Date(millis).toISOString();

const PENDING: Partial<Record<PublicState, string>> = {
	[PublicState.Releasing]: "payout pending",
	[PublicState.Refunding]: "refund pending",
};

export const jobView = (
	jobId: string,
	status: JobStatus,
	now: number,
): string => {
	const rows = status.transfers
		.map((transfer) => {
			const link = transfer.explorer_url
				? ` — <a href="${esc(transfer.explorer_url)}" target="_blank" rel="noopener">explorer</a>`
				: "";
			const failed =
				transfer.status === TransferStatus.Failed && transfer.last_error
					? `<br>last error: ${esc(transfer.last_error)}`
					: "";
			return `<li>${esc(transfer.kind)}: <b>${esc(transfer.status)}</b>${link}${failed}</li>`;
		})
		.join("");
	const left =
		status.state === PublicState.Paid
			? ` (${secondsLeft(status.deadline_at, now)}s left)`
			: "";
	const pending = PENDING[status.state];
	const note = pending ? ` <small>${esc(pending)}</small>` : "";
	const reason = status.refund_reason
		? `<dt>Refund reason</dt><dd>${esc(status.refund_reason)}</dd>`
		: "";
	const answer =
		status.answer !== null
			? `<dt>Answer</dt><dd><pre>${esc(status.answer)}</pre></dd>`
			: "";
	const body = `<h1>Job <small>${esc(jobId.slice(0, 8))}</small></h1>
<p><span class="state ${esc(status.state)}">${esc(status.state)}</span>${note}</p>
<dl>
<dt>Deadline</dt><dd>${iso(status.deadline_at)}${left}</dd>
<dt>Viewed by expert</dt><dd>${iso(status.viewed_at)}</dd>
${reason}${answer}
<dt>Transfers</dt><dd>${rows ? `<ul>${rows}</ul>` : "none yet"}</dd>
</dl>`;
	return page(`Job ${jobId}`, `<div class="card">${body}</div>`, 2);
};
