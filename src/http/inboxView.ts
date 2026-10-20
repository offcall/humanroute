// Expert inbox page: every open job with source text, MT draft, seconds left and an answer form.
import { MAX_ANSWER_LENGTH } from "../jobs/index.js";
import type { Job } from "../store/index.js";
import { countdown, esc, page } from "./views.js";

// Reload for new jobs, but never while the expert is typing an answer.
const RELOAD = `<script>
setInterval(function(){var t=document.querySelectorAll('textarea');for(var i=0;i<t.length;i++){
if(t[i]===document.activeElement||t[i].value!==t[i].defaultValue)return;}location.reload();},5000);
</script>`;

const card = (token: string, job: Job, now: number): string => {
	const action = `/inbox/${encodeURIComponent(token)}/jobs/${encodeURIComponent(job.id)}/answer`;
	return `<div class="card">
<div class="meta"><span>${esc(job.sourceLang)} → ${esc(job.targetLang)}</span>${countdown(job.deadlineAt, now)}</div>
<div class="label">${esc(job.sourceLang)} source</div><div class="text">${esc(job.text)}</div>
<div class="label">MT draft (${esc(job.targetLang)})</div><div class="draft">${job.draft ? esc(job.draft) : "—"}</div>
<form method="post" action="${action}">
<div class="label">Your translation</div>
<textarea name="answer" required maxlength="${MAX_ANSWER_LENGTH}">${esc(job.draft ?? "")}</textarea>
<button type="submit">Submit translation</button></form></div>`;
};

export const inboxPage = (token: string, jobs: Job[], now: number): string => {
	const cards = jobs.map((job) => card(token, job, now)).join("");
	const empty =
		'<div class="empty">No jobs waiting. This page refreshes itself.</div>';
	return page(
		"HumanRoute inbox",
		`<h1>Inbox · ${jobs.length} waiting</h1>${cards || empty}${RELOAD}`,
	);
};
