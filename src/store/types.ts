// Store types. Timestamps are Unix milliseconds; amounts are bigint base units.
// Enum values equal the strings stored in SQLite.
import type SqliteDriver from "better-sqlite3";
import type { JobsRepo } from "./jobTypes.js";
import type { TransfersRepo } from "./transferTypes.js";

export type * from "./jobTypes.js";
export type * from "./transferTypes.js";

export type Database = SqliteDriver.Database;
export type Row = Record<string, unknown>;

export enum JobState {
	Paid = "paid",
	Answered = "answered",
	Released = "released",
	Refunded = "refunded",
}

export enum TransferKind {
	Release = "release",
	Refund = "refund",
}

export enum TransferStatus {
	Pending = "pending",
	Sent = "sent",
	Confirmed = "confirmed",
	Failed = "failed",
}

export enum OrphanReason {
	UnparsableSettle = "unparsable_settle",
	WrongNetwork = "wrong_network",
	InvalidPayer = "invalid_payer",
	RecordFailed = "record_failed",
}

export type Payment = {
	paymentId: string;
	fingerprint: string;
	jobId: string;
	createdAt: number;
};

export type NewOrphan = {
	payTx: string | null;
	payer: string | null;
	network: string | null;
	rawHeader: string;
	reason: OrphanReason;
	now: number;
};

export type OrphansRepo = {
	insert(orphan: NewOrphan): void;
	countUnresolved(): number;
};

export type PaymentsRepo = {
	get(paymentId: string): Payment | undefined;
	insert(payment: Payment): void;
};

export type Store = {
	jobs: JobsRepo;
	transfers: TransfersRepo;
	payments: PaymentsRepo;
	orphans: OrphansRepo;
	transaction<T = unknown>(work: () => T): T;
	close(): void;
};
