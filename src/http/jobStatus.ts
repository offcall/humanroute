// Public job status. released/refunded appear only once the transfer is confirmed (ADR 0003);
// until then the job shows releasing/refunding.
import {
	type Job,
	JobState,
	type Store,
	type Transfer,
	TransferStatus,
} from "../store/index.js";
import { type JobStatus, PublicState } from "./types.js";

export const explorerUrl = (signature: string): string =>
	`https://explorer.solana.com/tx/${signature}?cluster=devnet`;

const publicState = (job: Job, transfer: Transfer | undefined): PublicState => {
	const confirmed = transfer?.status === TransferStatus.Confirmed;
	if (job.state === JobState.Released) {
		return confirmed ? PublicState.Released : PublicState.Releasing;
	}
	if (job.state === JobState.Refunded) {
		return confirmed ? PublicState.Refunded : PublicState.Refunding;
	}
	return job.state === JobState.Paid ? PublicState.Paid : PublicState.Answered;
};

export const jobStatus = (store: Store, job: Job): JobStatus => {
	const transfer = store.transfers.byJob(job.id);
	const transfers = transfer
		? [
				{
					kind: transfer.kind,
					status: transfer.status,
					tx_sig: transfer.txSig,
					attempts: transfer.attempts,
					last_error: transfer.lastError,
					explorer_url: transfer.txSig ? explorerUrl(transfer.txSig) : null,
				},
			]
		: [];
	const state = publicState(job, transfer);
	// The answer is handed out only once the expert payout is confirmed on-chain.
	const paidOut = state === PublicState.Released;
	return {
		state,
		refund_reason: job.refundReason,
		viewed_at: job.viewedAt,
		deadline_at: job.deadlineAt,
		answer: paidOut ? job.answer : null,
		transfers,
	};
};
