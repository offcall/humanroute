// One payout row of 1 unit to the linguist, left in the state a payouts test starts from.
import {
	LegRole,
	PayoutKind,
	type PayoutTransfer,
	taskLedger,
} from "../payouts/index.js";
import { TransferStatus } from "../store/index.js";
import { FAKE_BLOCKHASH } from "./chain.js";
import type { TestGateway } from "./gateway.js";
import { WALLETS } from "./wallets.js";

export const OLD_SIG = "old-sig";
export const LAST_VALID = 1000;

export type SeedOptions = {
	id?: string;
	taskId?: string;
	status?: TransferStatus.Pending | TransferStatus.Sent | TransferStatus.Failed;
	// Retries counted before the row reaches its status.
	attempts?: number;
	// Failed only: whether the row was sent as OLD_SIG before it failed.
	broadcast?: boolean;
};

// Sent rows (and broadcast failed ones) carry OLD_SIG, valid up to height LAST_VALID.
export const seedTransfer = (
	gateway: TestGateway,
	options: SeedOptions = {},
) => {
	const ledger = taskLedger(gateway.database);
	const id = options.id ?? "transfer-1";
	const taskId = options.taskId ?? "task-1";
	const status = options.status ?? TransferStatus.Pending;
	const now = gateway.clock.now();
	const legs = [
		{ role: LegRole.Linguist, wallet: WALLETS.linguist.address, units: 1n },
	];
	ledger.insert(
		{ id, taskId, kind: PayoutKind.Payout, legs, memo: `hr:${taskId}` },
		now,
	);
	for (let index = 0; index < (options.attempts ?? 0); index += 1) {
		ledger.backToPending(id, "retry", now);
	}
	const failed = status === TransferStatus.Failed;
	if (
		status === TransferStatus.Sent ||
		(failed && options.broadcast !== false)
	) {
		const sent = {
			txSig: OLD_SIG,
			blockhash: FAKE_BLOCKHASH,
			lastValidBlockHeight: LAST_VALID,
		};
		ledger.markSent(id, sent, now);
	}
	if (failed) {
		ledger.markFailed(id, "insufficient funds", now);
	}
	const row = (): PayoutTransfer => {
		const found = ledger.find(id);
		if (!found) {
			throw new Error("transfer row is missing");
		}
		return found;
	};
	const count = (method: string) =>
		gateway.chain.calls.filter((call) => call.method === method).length;

	return { ledger, row, count };
};
