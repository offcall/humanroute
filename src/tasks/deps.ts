// Ports the tasks slice needs from other slices, plus its read models (dependency injection, ADR 0019).
import type { Database, TransferStatus } from "../store/index.js";
import type { PartyPorts } from "./parties.js";
import type { Claimer, LangPair } from "./types.js";

// Money progress of the one transfer of a task, read from payouts.
export type TaskTransfer = {
	status: TransferStatus;
	payTx: string | null;
	memo: string;
	attempts: number;
	lastError: string | null;
	// updated_at of a confirmed transfer, else null.
	confirmedAt: number | null;
	// Linguist leg of a payout; null for a refund. Shown to the claimer only.
	linguistUnits: bigint | null;
};

export type Outcomes = { approved: number; rejected: number; late: number };

// Decision plus pending transfer in one transaction, provided by payouts (ADR 0023).
export type Decider = {
	approve(taskId: string): boolean;
	reject(taskId: string, reason: string): boolean;
};

export type TasksDeps = PartyPorts & {
	database: Database;
	now: () => number;
	sessionCookie: string;
	// Session wallet, or null when the token is missing, unknown or expired.
	lookupSession: (token: string | undefined) => string | null;
	firmByWallet: (wallet: string) => { id: string } | null;
	firmByMcpToken: (token: string) => { id: string } | null;
	agencyByWallet: (wallet: string) => { id: string } | null;
	linguistByWallet: (wallet: string) => Claimer | null;
	linguistPairs: (linguistId: string) => LangPair[];
	workWindowSeconds: number;
	transferOf: (taskId: string) => TaskTransfer | null;
	earnedUnits: (taskIds: string[]) => bigint;
	decider: Decider;
};
