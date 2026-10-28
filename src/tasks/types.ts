// Task types. Times are Unix ms; amounts are bigint base units.
// Enum values equal the strings stored in SQLite.

export enum TaskState {
	Open = "open",
	Claimed = "claimed",
	Submitted = "submitted",
	Approved = "approved",
	Rejected = "rejected",
	ExpiredUnclaimed = "expired_unclaimed",
	ExpiredLate = "expired_late",
}

export enum PublicState {
	Open = "open",
	Claimed = "claimed",
	Submitted = "submitted",
	PayingOut = "paying_out",
	Refunding = "refunding",
	PaidOut = "paid_out",
	Refunded = "refunded",
}

export type Task = {
	id: string;
	orderId: string;
	firmId: string;
	sourceLang: string;
	targetLang: string;
	text: string;
	draft: string;
	result: string | null;
	reason: string | null;
	state: TaskState;
	priceUnits: bigint;
	refundWallet: string;
	linguistId: string | null;
	linguistWallet: string | null;
	agencyId: string | null;
	agencyWallet: string | null;
	claimDeadline: number;
	workDeadline: number | null;
	createdAt: number;
	updatedAt: number;
};

export type NewTask = Pick<
	Task,
	| "id"
	| "orderId"
	| "firmId"
	| "sourceLang"
	| "targetLang"
	| "text"
	| "draft"
	| "priceUnits"
	| "refundWallet"
	| "claimDeadline"
>;

// Payee snapshot written on the task row at claim (ADR 0023).
export type Claimer = {
	linguistId: string;
	linguistWallet: string;
	agencyId: string;
	agencyWallet: string;
};

export type LangPair = { source: string; target: string };
