// jobs rows and their repository.
import type { JobState } from "./types.js";

export type Job = {
	id: string;
	state: JobState;
	payTx: string;
	payer: string;
	text: string;
	sourceLang: string;
	targetLang: string;
	draft: string | null;
	answer: string | null;
	viewedAt: number | null;
	deadlineAt: number;
	refundReason: string | null;
	createdAt: number;
	updatedAt: number;
};

export type NewJob = {
	id: string;
	payTx: string;
	payer: string;
	text: string;
	sourceLang: string;
	targetLang: string;
	draft: string | null;
	deadlineAt: number;
	now: number;
};

export type JobsRepo = {
	get(jobId: string): Job | undefined;
	byPayTx(payTx: string): Job | undefined;
	insertPaid(job: NewJob): Job;
	listOpen(now: number): Job[];
	listExpired(now: number): Job[];
	listByState(state: JobState): Job[];
	markViewed(jobId: string, now: number): boolean;
	answer(jobId: string, answer: string, now: number): boolean;
	decide(
		jobId: string,
		fromState: JobState,
		toState: JobState,
		reason: string | null,
		now: number,
	): boolean;
};
