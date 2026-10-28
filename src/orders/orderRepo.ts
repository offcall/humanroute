// orders and payments rows (ADR 0022). Callers own the transaction.
import {
	type Database,
	int,
	type Row,
	row,
	rows,
	text,
	units,
} from "../store/index.js";
import { tasksByOrder } from "../tasks/index.js";
import { ORDERS_SQL } from "./sql.js";
import type { Order, Payment, Receipt } from "./types.js";

const toOrder = (record: Row): Order => ({
	id: text(record, "id"),
	draftId: text(record, "draft_id"),
	firmId: text(record, "firm_id"),
	payTx: text(record, "pay_tx"),
	payer: text(record, "payer"),
	totalUnits: units(record, "total_units"),
	createdAt: int(record, "created_at"),
});

export const orderById = (
	database: Database,
	orderId: string,
): Order | null => {
	const found = row(database.prepare(ORDERS_SQL.orderById).get(orderId));
	return found ? toOrder(found) : null;
};

export const ordersByFirm = (database: Database, firmId: string): Order[] =>
	rows(database.prepare(ORDERS_SQL.ordersByFirm).all(firmId)).map(toOrder);

export const paymentById = (
	database: Database,
	paymentId: string,
): Payment | null => {
	const found = row(database.prepare(ORDERS_SQL.paymentById).get(paymentId));
	if (!found) {
		return null;
	}
	return {
		paymentId: text(found, "payment_id"),
		draftId: text(found, "draft_id"),
		orderId: text(found, "order_id"),
	};
};

// The 201 body of POST /x/orders/:draftId, also returned on replay.
export const receiptOf = (
	database: Database,
	orderId: string,
): Receipt | null => {
	const order = orderById(database, orderId);
	if (!order) {
		return null;
	}
	const taskIds = tasksByOrder(database, orderId).map((task) => task.id);
	return { orderId, taskIds, payTx: order.payTx };
};

export const countUnresolvedOrphans = (database: Database): number => {
	const found = row(database.prepare(ORDERS_SQL.unresolvedOrphans).get());
	return found ? int(found, "total") : 0;
};
