export enum Language {
	En = "en",
	Es = "es",
	Fr = "fr",
	De = "de",
	It = "it",
	Pt = "pt",
	Ru = "ru",
}

export enum TaskState {
	Open = "open",
	Claimed = "claimed",
	Submitted = "submitted",
	Approved = "approved",
	Rejected = "rejected",
	ExpiredLate = "expired_late",
	ExpiredUnclaimed = "expired_unclaimed",
}

export type LanguagePair = { source: string; target: string };

export type Firm = { id: string; name: string };
export type Agency = { id: string; name: string };
export type Linguist = { id: string; agencyId: string };

export type Me = {
	wallet: string;
	firm: Firm | null;
	agency: Agency | null;
	linguist: Linguist | null;
};

export type BoardTask = {
	taskId: string;
	firmName: string;
	sourceLang: string;
	targetLang: string;
	priceUnits: bigint;
	claimDeadline: string;
	text: string;
	draft: string;
};

export type Transfer = {
	status: string;
	payTx: string | null;
	memo: string;
	attempts: number;
	lastError: string | null;
	explorerUrl: string | null;
	confirmedAt: string | null;
	earnedUnits: bigint | null;
};

// Who ordered and who executes a task (ADR 0033); agency and translatorNo are null while open.
export type TaskParties = {
	firmName: string;
	agency: Agency | null;
	translatorNo: number | null;
};

export type Task = TaskParties & {
	taskId: string;
	orderId: string;
	sourceLang: string;
	targetLang: string;
	text: string;
	draft: string;
	result: string | null;
	state: TaskState;
	publicState: string;
	priceUnits: bigint;
	claimDeadline: string;
	workDeadline: string | null;
	reason: string | null;
	transfer: Transfer | null;
};

export type Order = {
	orderId: string;
	payTx: string;
	totalUnits: bigint;
	createdAt: string;
	tasks: Task[];
};

export type AgencyRating = {
	agencyId: string;
	ratingPct: number | null;
	approved: number;
	rejected: number;
	late: number;
	paidUnits: bigint;
};

export type FirmRating = {
	firmId: string;
	rejectPct: number | null;
	approved: number;
	rejected: number;
	spentUnits: bigint;
	refundedUnits: bigint;
};

export type ApiError = { error: string; message?: string };
