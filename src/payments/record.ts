// After settlement: job (unique by pay_tx) and payment identity commit in one SQLite transaction.
import type { Job, Store } from "../store/index.js";
import type { RecordInput } from "./types.js";

export const recordPaid = (store: Store, input: RecordInput): Job =>
	store.transaction(() => {
		const job = store.jobs.insertPaid({
			id: input.newId(),
			payTx: input.settlement.transaction,
			payer: input.settlement.payer,
			text: input.body.text,
			sourceLang: input.body.sourceLang,
			targetLang: input.body.targetLang,
			draft: input.body.draft,
			deadlineAt: input.now + input.slaSeconds * 1000,
			now: input.now,
		});
		if (input.paymentId && !store.payments.get(input.paymentId)) {
			store.payments.insert({
				paymentId: input.paymentId,
				fingerprint: input.fingerprint,
				jobId: job.id,
				createdAt: input.now,
			});
		}
		return job;
	});
