// Order types and side-effect interfaces. Times are Unix ms; amounts are bigint base units.
import type { FacilitatorClient } from "@x402/core/server";
import type { Network } from "../config/index.js";
import type { Database } from "../store/index.js";
import type { PartyPorts, TaskTransfer } from "../tasks/index.js";

export enum DraftState {
	Draft = "draft",
	Paid = "paid",
	Orphaned = "orphaned",
	Settling = "settling",
}

export enum AutopayStatus {
	Available = "available",
	Unavailable = "unavailable",
	Unknown = "unknown",
}

export enum OrphanReason {
	UnparsableSettle = "unparsable_settle",
	WrongNetwork = "wrong_network",
	InvalidPayer = "invalid_payer",
	RecordFailed = "record_failed",
	// The settle may have broadcast: pending, transport error, timeout, 5xx (ADR 0043).
	SettleUnknown = "settle_unknown",
}

export type DraftTarget = { targetLang: string; draft: string };

export type DraftBody = {
	text: string;
	sourceLang: string;
	targets: DraftTarget[];
	metaJson: string | null;
};

export type Draft = DraftBody & {
	id: string;
	firmId: string;
	priceUnits: bigint;
	totalUnits: bigint;
	taskCount: number;
	createdAt: number;
	orderId: string | null;
};

export type Order = {
	id: string;
	draftId: string;
	firmId: string;
	payTx: string;
	payer: string;
	totalUnits: bigint;
	createdAt: number;
};

// Payment identity (ADR 0004) of a recorded order.
export type Payment = { paymentId: string; draftId: string; orderId: string };

export type Receipt = { orderId: string; taskIds: string[]; payTx: string };

export type Settlement = {
	transaction: string;
	payer: string;
	network: string;
};

export type SettleRejection = { reason: OrphanReason; error: string };

// Best-effort fields for the log line written before validation; null when absent.
export type SettlePeek = {
	transaction: string | null;
	payer: string | null;
	network: string | null;
};

// The firm's USDC token account and a chain read result (ADR 0036); wired from chain.
export type FirmTokenAccount =
	| { exists: false; address: string }
	| {
			exists: true;
			address: string;
			amount: bigint;
			delegate: string | null;
			delegatedAmount: bigint;
	  };
export type ChainRead<T = unknown> =
	| { ok: true; value: T }
	| { ok: false; error: string };

// One new open task, reported after the order commits (ADR 0029). claimDeadline: Unix ms.
export type CreatedTask = {
	taskId: string;
	source: string;
	target: string;
	claimDeadline: number;
};

export type OrdersDeps = PartyPorts & {
	database: Database;
	facilitator: FacilitatorClient;
	network: Network;
	usdcMint: string;
	payTo: string;
	taskPriceUnits: bigint;
	claimWindowSeconds: number;
	draftTtlSeconds: number;
	publicBaseUrl: string;
	sessionCookie: string;
	lookupSession: (token: string | undefined) => string | null;
	firmByWallet: (wallet: string) => { id: string } | null;
	firmByMcpToken: (token: string) => { id: string } | null;
	// The firm's login wallet: the refund wallet of its tasks (ADR 0036).
	firmWallet: (firmId: string) => string | null;
	tokenAccountOf: (owner: string) => Promise<ChainRead<FirmTokenAccount>>;
	solBalanceOf: (owner: string) => Promise<ChainRead<number>>;
	latestBlockhash: () => Promise<
		ChainRead<{ blockhash: string; lastValidBlockHeight: number }>
	>;
	transferOf: (taskId: string) => TaskTransfer | null;
	preflightProblems: () => string[];
	now: () => number;
	sleep: (millis: number, signal: AbortSignal) => Promise<void>;
	newId: () => string;
	log: (msg: string) => void;
	// Fire-and-forget after commit; absent when push is not wired (ADR 0029).
	onTasksCreated?: (tasks: CreatedTask[]) => Promise<void>;
};

// settleStarted: the pay handler ran, so the x402 middleware calls settle next (ADR 0043).
export type OrdersEnv = {
	Variables: { draft: Draft | undefined; settleStarted: boolean | undefined };
};
