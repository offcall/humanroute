import type {
	ChainResult,
	SignedTransfer,
	SolanaClient,
} from "../chain/index.js";
import type { TransferStatus } from "../store/index.js";

// Signature and blockhash persisted before broadcast (ADR 0006).
export type SentInfo = {
	txSig: string;
	blockhash: string;
	lastValidBlockHeight: number;
};

export type Worker = {
	start(): Promise<void>;
	stop(): void;
	tick(): Promise<void>;
};

// Fields of a transfer row that sending, recovery and requeue need.
export type Sendable = {
	id: string;
	memo: string;
	status: TransferStatus;
	txSig: string | null;
	lastValidBlockHeight: number | null;
	attempts: number;
	updatedAt: number;
};

// Guarded status changes of one transfers table; false when the row was not in the expected status.
export type Ledger<T extends Sendable = Sendable> = {
	listByStatus(status: TransferStatus): T[];
	markSent(transferId: string, sent: SentInfo, now: number): boolean;
	markConfirmed(transferId: string, txSig: string, now: number): boolean;
	markFailed(transferId: string, error: string, now: number): boolean;
	backToPending(transferId: string, error: string, now: number): boolean;
};

export type SendDeps<T extends Sendable = Sendable> = {
	ledger: Ledger<T>;
	chain: SolanaClient;
	// Builds and signs the one transaction of the transfer; no network send.
	sign: (transfer: T) => Promise<ChainResult<SignedTransfer>>;
	// Short log label: kind, owner id, memo. Public keys and ids only.
	describe: (transfer: T) => string;
	maxAttempts: number;
	now: () => number;
	log: (msg: string) => void;
};

// Ruling on a signature the chain reports unknown (ADR 0006).
// expired: past last_valid_block_height and no hold transaction carries the memo, so it can never land.
export type Expiry =
	| { state: "live" }
	| { state: "expired" }
	| { state: "landed"; signature: string }
	| { state: "unavailable"; error: string };

export type RequeueLedger<T extends Sendable = Sendable> = {
	// Transfer by its id, else by its task id.
	find(idOrTaskId: string): T | undefined;
	// failed -> pending; keeps attempts, clears last_error and the old signature.
	requeue(transferId: string, now: number): boolean;
};

export type RequeueDeps<T extends Sendable = Sendable> = {
	store: RequeueLedger<T>;
	chain: SolanaClient;
	now: () => number;
};

export type RequeueResult<T extends Sendable = Sendable> =
	| { outcome: "requeued"; transfer: T }
	| { outcome: "refused"; reason: string }
	| { outcome: "error"; error: string };
