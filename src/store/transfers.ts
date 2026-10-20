// transfers table: one row per job (UNIQUE job_id), status pending -> sent -> confirmed | failed.
import { row, rows } from "./columns.js";
import { TRANSFERS_SQL } from "./sql.js";
import { toTransfer } from "./transferRow.js";
import type {
	Database,
	NewTransfer,
	Transfer,
	TransfersRepo,
} from "./types.js";

export const transfersRepo = (database: Database): TransfersRepo => {
	const stmts = {
		insert: database.prepare(TRANSFERS_SQL.insert),
		byId: database.prepare(TRANSFERS_SQL.byId),
		byJob: database.prepare(TRANSFERS_SQL.byJob),
		byStatus: database.prepare(TRANSFERS_SQL.byStatus),
		sent: database.prepare(TRANSFERS_SQL.sent),
		confirmed: database.prepare(TRANSFERS_SQL.confirmed),
		failed: database.prepare(TRANSFERS_SQL.failed),
		pending: database.prepare(TRANSFERS_SQL.pending),
	};
	const one = (value: unknown): Transfer | undefined => {
		const found = row(value);
		return found ? toTransfer(found) : undefined;
	};

	return {
		insert: (transfer: NewTransfer) => {
			stmts.insert.run(
				transfer.id,
				transfer.jobId,
				transfer.kind,
				transfer.toWallet,
				transfer.amount.toString(),
				transfer.memo,
				transfer.now,
				transfer.now,
			);
			const created = one(stmts.byId.get(transfer.id));
			if (!created) {
				throw new Error(`transfer ${transfer.id} missing after insert`);
			}
			return created;
		},
		byJob: (jobId) => one(stmts.byJob.get(jobId)),
		listByStatus: (status) => rows(stmts.byStatus.all(status)).map(toTransfer),
		markSent: (transferId, sent, now) =>
			stmts.sent.run(
				sent.txSig,
				sent.blockhash,
				sent.lastValidBlockHeight,
				now,
				transferId,
			).changes === 1,
		markConfirmed: (transferId, txSig, now) =>
			stmts.confirmed.run(txSig, now, transferId).changes === 1,
		markFailed: (transferId, error, now) =>
			stmts.failed.run(error, now, transferId).changes === 1,
		// Only after the previous signature can no longer land (ADR 0006) or was never broadcast.
		backToPending: (transferId, error, now) =>
			stmts.pending.run(error, now, transferId).changes === 1,
	};
};
