// The transfer part of TaskView (api.md, ADR 0033): ISO confirmation time, explorer link,
// and the linguist's share only in the claimer's own views.
import type { TaskTransfer } from "./deps.js";

const EXPLORER = "https://explorer.solana.com/tx";

export const transferView = (transfer: TaskTransfer, forClaimer: boolean) => ({
	status: transfer.status,
	payTx: transfer.payTx,
	memo: transfer.memo,
	attempts: transfer.attempts,
	lastError: transfer.lastError,
	explorerUrl:
		transfer.payTx === null
			? null
			: `${EXPLORER}/${transfer.payTx}?cluster=devnet`,
	confirmedAt:
		transfer.confirmedAt === null
			? null
			: new Date(transfer.confirmedAt).toISOString(),
	earnedUnits:
		forClaimer && transfer.linguistUnits !== null
			? transfer.linguistUnits.toString()
			: null,
});
