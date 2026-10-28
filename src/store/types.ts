// Store types. Timestamps are Unix milliseconds; amounts are bigint base units.
// Enum values equal the strings stored in SQLite.
import type SqliteDriver from "better-sqlite3";

export type Database = SqliteDriver.Database;
export type Row = Record<string, unknown>;

export enum TransferStatus {
	Pending = "pending",
	Sent = "sent",
	Confirmed = "confirmed",
	Failed = "failed",
}
