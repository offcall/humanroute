// v2 transfers access for the worker, the deciders and the operator requeue.
import type { Database } from "../store/index.js";
import { asRow, asRows } from "../tasks/index.js";
import { legsJson, toPayoutTransfer } from "./row.js";
import { PAYOUTS_SQL } from "./sql.js";
import type { NewPayoutTransfer, PayoutTransfer } from "./taskTypes.js";
import type { Ledger, RequeueLedger } from "./types.js";

export type TaskLedger = Ledger<PayoutTransfer> &
	RequeueLedger<PayoutTransfer> & {
		insert(transfer: NewPayoutTransfer, now: number): void;
		byTaskId(taskId: string): PayoutTransfer | null;
	};

const one = (value: unknown): PayoutTransfer | null => {
	const found = asRow(value);
	return found ? toPayoutTransfer(found) : null;
};

export const taskLedger = (database: Database): TaskLedger => {
	const run = (sql: string, ...params: unknown[]): boolean =>
		database.prepare(sql).run(...params).changes === 1;

	return {
		insert: (transfer, now) => {
			const { id, taskId, kind, legs, memo } = transfer;
			database
				.prepare(PAYOUTS_SQL.insert)
				.run(id, taskId, kind, legsJson(legs), memo, now, now);
		},
		byTaskId: (taskId) => one(database.prepare(PAYOUTS_SQL.byTask).get(taskId)),
		listByStatus: (status) =>
			asRows(database.prepare(PAYOUTS_SQL.byStatus).all(status)).map(
				toPayoutTransfer,
			),
		markSent: (transferId, sent, now) =>
			run(
				PAYOUTS_SQL.sent,
				sent.txSig,
				sent.blockhash,
				sent.lastValidBlockHeight,
				now,
				transferId,
			),
		markConfirmed: (transferId, txSig, now) =>
			run(PAYOUTS_SQL.confirmed, txSig, now, transferId),
		markFailed: (transferId, error, now) =>
			run(PAYOUTS_SQL.failed, error, now, transferId),
		// Only after the previous signature can no longer land (ADR 0006) or was never broadcast.
		backToPending: (transferId, error, now) =>
			run(PAYOUTS_SQL.pending, error, now, transferId),
		find: (idOrTaskId) =>
			one(database.prepare(PAYOUTS_SQL.find).get(idOrTaskId, idOrTaskId)) ??
			undefined,
		requeue: (transferId, now) => run(PAYOUTS_SQL.requeue, now, transferId),
	};
};
