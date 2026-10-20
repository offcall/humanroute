import type { SolanaClient } from "../chain/index.js";
import type { PayoutTerms } from "../jobs/index.js";
import type { RequeueStore, Store, Transfer } from "../store/index.js";

export type PayoutDeps = {
	store: Store;
	chain: SolanaClient;
	terms: PayoutTerms;
	maxAttempts: number;
	// Non-empty while the preflight fails; the worker then sends nothing (ADR 0008).
	preflightProblems: () => string[];
	now: () => number;
	newId: () => string;
	log: (msg: string) => void;
};

export type Worker = {
	start(): Promise<void>;
	stop(): void;
	tick(): Promise<void>;
};

// Ruling on a signature the chain reports unknown (ADR 0006).
// expired: past last_valid_block_height and no hold transaction carries the memo, so it can never land.
export type Expiry =
	| { state: "live" }
	| { state: "expired" }
	| { state: "landed"; signature: string }
	| { state: "unavailable"; error: string };

export type RequeueDeps = {
	store: RequeueStore;
	chain: SolanaClient;
	now: () => number;
};

export type RequeueResult =
	| { outcome: "requeued"; transfer: Transfer }
	| { outcome: "refused"; reason: string }
	| { outcome: "error"; error: string };
