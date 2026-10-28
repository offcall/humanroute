// Confirmed money per leg role over a set of tasks (cabinets count confirmed transfers only, ADR 0018).
import { type Database, TransferStatus } from "../store/index.js";
import {
	type TaskTransfer,
	taskIdsByAgency,
	taskIdsByFirm,
} from "../tasks/index.js";
import { taskLedger } from "./ledger.js";
import { LegRole } from "./taskTypes.js";

export const confirmedUnits = (
	database: Database,
	taskIds: string[],
	role: LegRole,
): bigint => {
	const wanted = new Set(taskIds);
	let total = 0n;
	for (const transfer of taskLedger(database).listByStatus(
		TransferStatus.Confirmed,
	)) {
		if (!wanted.has(transfer.taskId)) {
			continue;
		}
		for (const leg of transfer.legs) {
			if (leg.role === role) {
				total += leg.units;
			}
		}
	}
	return total;
};

// Money totals for the rating slice (ADR 0025): confirmed transfers only.
export const moneyByAgency = (
	database: Database,
	agencyId: string,
): { paidUnits: bigint } => ({
	paidUnits: confirmedUnits(
		database,
		taskIdsByAgency(database, agencyId),
		LegRole.Agency,
	),
});

export const moneyByFirm = (
	database: Database,
	firmId: string,
): { spentUnits: bigint; refundedUnits: bigint } => {
	const taskIds = taskIdsByFirm(database, firmId);
	const spentUnits = [LegRole.Linguist, LegRole.Agency, LegRole.Fee].reduce(
		(sum, role) => sum + confirmedUnits(database, taskIds, role),
		0n,
	);
	return {
		spentUnits,
		refundedUnits: confirmedUnits(database, taskIds, LegRole.Refund),
	};
};

// The tasks slice's view of a task's transfer (TasksDeps.transferOf).
export const transferViewOf =
	(database: Database) =>
	(taskId: string): TaskTransfer | null => {
		const transfer = taskLedger(database).byTaskId(taskId);
		if (!transfer) {
			return null;
		}
		const { status, txSig, memo, attempts, lastError } = transfer;
		return { status, payTx: txSig, memo, attempts, lastError };
	};
