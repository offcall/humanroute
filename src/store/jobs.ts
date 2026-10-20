// jobs table. State transitions are guarded by WHERE state = ? so only one writer wins.
import { row, rows } from "./columns.js";
import { toJob } from "./jobRow.js";
import { JOBS_SQL } from "./sql.js";
import type { Database, Job, JobsRepo, NewJob } from "./types.js";

export const jobsRepo = (database: Database): JobsRepo => {
	const stmts = {
		byId: database.prepare(JOBS_SQL.byId),
		byPayTx: database.prepare(JOBS_SQL.byPayTx),
		insert: database.prepare(JOBS_SQL.insert),
		open: database.prepare(JOBS_SQL.open),
		expired: database.prepare(JOBS_SQL.expired),
		byState: database.prepare(JOBS_SQL.byState),
		viewed: database.prepare(JOBS_SQL.viewed),
		answer: database.prepare(JOBS_SQL.answer),
		decide: database.prepare(JOBS_SQL.decide),
	};
	const one = (value: unknown): Job | undefined => {
		const found = row(value);
		return found ? toJob(found) : undefined;
	};

	return {
		get: (jobId) => one(stmts.byId.get(jobId)),
		byPayTx: (payTx) => one(stmts.byPayTx.get(payTx)),
		// Idempotent on pay_tx: a second insert for the same settlement returns the existing job.
		insertPaid: (job: NewJob) => {
			stmts.insert.run(
				job.id,
				job.payTx,
				job.payer,
				job.text,
				job.sourceLang,
				job.targetLang,
				job.draft,
				job.deadlineAt,
				job.now,
				job.now,
			);
			const stored = one(stmts.byPayTx.get(job.payTx));
			if (!stored) {
				throw new Error(`job for pay_tx ${job.payTx} missing after insert`);
			}
			return stored;
		},
		listOpen: (now) => rows(stmts.open.all(now)).map(toJob),
		listExpired: (now) => rows(stmts.expired.all(now)).map(toJob),
		listByState: (state) => rows(stmts.byState.all(state)).map(toJob),
		markViewed: (jobId, now) => stmts.viewed.run(now, now, jobId).changes === 1,
		// Accepted only while paid and strictly before the deadline (server clock).
		answer: (jobId, answer, now) =>
			stmts.answer.run(answer, now, jobId, now).changes === 1,
		decide: (jobId, fromState, toState, reason, now) =>
			stmts.decide.run(toState, reason, now, jobId, fromState).changes === 1,
	};
};
