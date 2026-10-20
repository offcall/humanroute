// Sweep (ADR 0005, claim then send): the decision and its transfer row commit in one SQLite
// transaction; the payouts worker sends only from that committed pending row.
import {
	type Job,
	JobState,
	type Store,
	type Transfer,
	TransferKind,
} from "../store/index.js";
import type { PayoutTerms } from "./types.js";

export const memoFor = (jobId: string): string => `hr:${jobId}`;

type Claim = {
	job: Job;
	toState: JobState;
	kind: TransferKind;
	reason: string | null;
};

const claim = (
	store: Store,
	{ job, toState, kind, reason }: Claim,
	terms: PayoutTerms,
	now: number,
	newId: () => string,
): Transfer | null => {
	if (!store.jobs.decide(job.id, job.state, toState, reason, now)) {
		return null;
	}
	const release = kind === TransferKind.Release;
	return store.transfers.insert({
		id: newId(),
		jobId: job.id,
		kind,
		toWallet: release ? terms.expertWallet : job.payer,
		amount: release ? terms.releaseUnits : terms.refundUnits,
		memo: memoFor(job.id),
		now,
	});
};

// paid past deadline -> refunded (sla_expired); answered -> released. Returns the new transfers.
export const sweep = (
	store: Store,
	terms: PayoutTerms,
	now: number,
	newId: () => string,
): Transfer[] =>
	store.transaction(() => {
		const claims: Claim[] = [
			...store.jobs.listExpired(now).map((job) => ({
				job,
				toState: JobState.Refunded,
				kind: TransferKind.Refund,
				reason: "sla_expired",
			})),
			...store.jobs.listByState(JobState.Answered).map((job) => ({
				job,
				toState: JobState.Released,
				kind: TransferKind.Release,
				reason: null,
			})),
		];
		const out: Transfer[] = [];
		for (const next of claims) {
			const transfer = claim(store, next, terms, now, newId);
			if (transfer) {
				out.push(transfer);
			}
		}
		return out;
	});
