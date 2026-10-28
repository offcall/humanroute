// v2 transfers: one row per task, a split payout or a refund (ADR 0024).
import type { SolanaClient } from "../chain/index.js";
import type { Database, TransferStatus } from "../store/index.js";

export enum PayoutKind {
	Payout = "payout",
	Refund = "refund",
}

export enum LegRole {
	Linguist = "linguist",
	Agency = "agency",
	Fee = "fee",
	Refund = "refund",
}

export type Leg = { role: LegRole; wallet: string; units: bigint };

export type PayoutTransfer = {
	id: string;
	taskId: string;
	kind: PayoutKind;
	legs: Leg[];
	memo: string;
	status: TransferStatus;
	txSig: string | null;
	blockhash: string | null;
	lastValidBlockHeight: number | null;
	attempts: number;
	lastError: string | null;
	createdAt: number;
	updatedAt: number;
};

export type NewPayoutTransfer = Pick<
	PayoutTransfer,
	"id" | "taskId" | "kind" | "legs" | "memo"
>;

// Fixed split from config (ADR 0024); the linguist gets the rest and the rounding remainder.
export type Shares = { agencyBps: bigint; feeBps: bigint; feeWallet: string };

export type TaskPayoutDeps = {
	database: Database;
	chain: SolanaClient;
	shares: Shares;
	maxAttempts: number;
	// Non-empty while the preflight fails; the worker then sends nothing (ADR 0008).
	preflightProblems: () => string[];
	now: () => number;
	newId: () => string;
	log: (msg: string) => void;
};
