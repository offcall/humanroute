// transfers rows, their repository and the operator requeue store.
import type { TransferKind, TransferStatus } from "./types.js";

export type Transfer = {
	id: string;
	jobId: string;
	kind: TransferKind;
	toWallet: string;
	amount: bigint;
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

export type NewTransfer = {
	id: string;
	jobId: string;
	kind: TransferKind;
	toWallet: string;
	amount: bigint;
	memo: string;
	now: number;
};

export type SentInfo = {
	txSig: string;
	blockhash: string;
	lastValidBlockHeight: number;
};

export type TransfersRepo = {
	insert(transfer: NewTransfer): Transfer;
	byJob(jobId: string): Transfer | undefined;
	listByStatus(status: TransferStatus): Transfer[];
	markSent(transferId: string, sent: SentInfo, now: number): boolean;
	markConfirmed(transferId: string, txSig: string, now: number): boolean;
	markFailed(transferId: string, error: string, now: number): boolean;
	backToPending(transferId: string, error: string, now: number): boolean;
};

export type RequeueStore = {
	migrated: string[];
	// Transfer by its id, else by its job id.
	find(idOrJobId: string): Transfer | undefined;
	// failed -> pending; keeps attempts, clears last_error and the old signature.
	requeue(transferId: string, now: number): boolean;
	close(): void;
};
