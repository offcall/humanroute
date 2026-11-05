// After settlement: the order, its N open tasks and the payment identity commit in one SQLite
// transaction (ADR 0022). Every task refunds to the firm's login wallet (ADR 0036).
import { withTransaction } from "../store/index.js";
import { insertTasks, type NewTask } from "../tasks/index.js";
import { ORDERS_SQL } from "./sql.js";
import type { Draft, OrdersDeps, Receipt, Settlement } from "./types.js";

export const recordOrder = (
	deps: OrdersDeps,
	draft: Draft,
	settlement: Settlement,
	paymentId: string | null,
): Receipt =>
	withTransaction(deps.database, () => {
		const { database } = deps;
		const refundWallet = deps.firmWallet(draft.firmId);
		if (refundWallet === null) {
			throw new Error(`firm ${draft.firmId} of draft ${draft.id} not found`);
		}
		const now = deps.now();
		const orderId = deps.newId();
		const paid = database.prepare(ORDERS_SQL.markPaid).run(orderId, draft.id);
		if (paid.changes !== 1) {
			throw new Error(`draft ${draft.id} is already paid`);
		}
		database
			.prepare(ORDERS_SQL.insertOrder)
			.run(
				orderId,
				draft.id,
				draft.firmId,
				settlement.transaction,
				settlement.payer,
				draft.totalUnits.toString(),
				now,
			);
		const tasks: NewTask[] = draft.targets.map((target) => ({
			id: deps.newId(),
			orderId,
			firmId: draft.firmId,
			sourceLang: draft.sourceLang,
			targetLang: target.targetLang,
			text: draft.text,
			draft: target.draft,
			priceUnits: draft.priceUnits,
			refundWallet,
			claimDeadline: now + deps.claimWindowSeconds * 1000,
		}));
		insertTasks(database, tasks, now);
		if (paymentId !== null) {
			database
				.prepare(ORDERS_SQL.insertPayment)
				.run(paymentId, draft.id, orderId, now);
		}
		const taskIds = tasks.map((task) => task.id);
		return { orderId, taskIds, payTx: settlement.transaction };
	});
