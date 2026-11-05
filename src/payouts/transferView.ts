// The tasks slice's read of a task's transfer (TasksDeps.transferOf, ADR 0033). Read-only: no send, no row change.
import { type Database, TransferStatus } from "../store/index.js";
import type { TaskTransfer } from "../tasks/index.js";
import { taskLedger } from "./ledger.js";
import { LegRole, PayoutKind, type PayoutTransfer } from "./taskTypes.js";

// The linguist leg of a payout; null for a refund.
const linguistUnits = (transfer: PayoutTransfer): bigint | null => {
	if (transfer.kind !== PayoutKind.Payout) {
		return null;
	}
	const leg = transfer.legs.find((item) => item.role === LegRole.Linguist);
	return leg === undefined ? null : leg.units;
};

export const transferViewOf =
	(database: Database) =>
	(taskId: string): TaskTransfer | null => {
		const transfer = taskLedger(database).byTaskId(taskId);
		if (!transfer) {
			return null;
		}
		const { status, txSig, memo, attempts, lastError } = transfer;
		return {
			status,
			payTx: txSig,
			memo,
			attempts,
			lastError,
			// A confirmed row is final, so its updated_at is the confirmation time.
			confirmedAt:
				status === TransferStatus.Confirmed ? transfer.updatedAt : null,
			linguistUnits: linguistUnits(transfer),
		};
	};
