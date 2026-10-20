import type { PaymentsDeps } from "../payments/index.js";
import type { Store } from "../store/index.js";

export type AppDeps = PaymentsDeps;

export type InboxDeps = { store: Store; inboxToken: string; now: () => number };

export type StatusDeps = {
	store: Store;
	statusSecret: string;
	now: () => number;
};

// Public job state. released/refunded only once the transfer is confirmed (ADR 0003).
export enum PublicState {
	Paid = "paid",
	Answered = "answered",
	Releasing = "releasing",
	Refunding = "refunding",
	Released = "released",
	Refunded = "refunded",
}

export type JobStatus = {
	state: PublicState;
	refund_reason: string | null;
	viewed_at: number | null;
	deadline_at: number;
	answer: string | null;
	transfers: {
		kind: string;
		status: string;
		tx_sig: string | null;
		attempts: number;
		last_error: string | null;
		explorer_url: string | null;
	}[];
};
