// Maps a jobs row to Job.
import { int, oneOf, optInt, optText, text } from "./columns.js";
import { type Job, JobState, type Row } from "./types.js";

const STATES: readonly JobState[] = Object.values(JobState);

export const toJob = (record: Row): Job => ({
	id: text(record, "id"),
	state: oneOf(record, "state", STATES),
	payTx: text(record, "pay_tx"),
	payer: text(record, "payer"),
	text: text(record, "text"),
	sourceLang: text(record, "source_lang"),
	targetLang: text(record, "target_lang"),
	draft: optText(record, "draft"),
	answer: optText(record, "answer"),
	viewedAt: optInt(record, "viewed_at"),
	deadlineAt: int(record, "deadline_at"),
	refundReason: optText(record, "refund_reason"),
	createdAt: int(record, "created_at"),
	updatedAt: int(record, "updated_at"),
});
