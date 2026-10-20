// Expert answer: accepted only while the job is paid and the server clock is before the deadline.
import { JobState, type Store } from "../store/index.js";
import type { AnswerResult } from "./types.js";

export const MAX_ANSWER_LENGTH = 10_000;

export const answer = (
	store: Store,
	jobId: string,
	raw: unknown,
	now: number,
): AnswerResult => {
	if (typeof raw !== "string" || raw.trim() === "") {
		return { ok: false, status: 400, error: "answer is required" };
	}
	const text = raw.trim();
	if (text.length > MAX_ANSWER_LENGTH) {
		return {
			ok: false,
			status: 400,
			error: `answer too long (max ${MAX_ANSWER_LENGTH})`,
		};
	}
	if (store.jobs.answer(jobId, text, now)) {
		return { ok: true };
	}
	const job = store.jobs.get(jobId);
	if (!job) {
		return { ok: false, status: 404, error: "job not found" };
	}
	const error =
		job.state === JobState.Paid ? "deadline has passed" : `job is ${job.state}`;
	return { ok: false, status: 409, error };
};
