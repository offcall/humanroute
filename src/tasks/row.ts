// Maps a tasks row to Task; price_units TEXT -> bigint at the boundary.
import {
	int,
	oneOf,
	optInt,
	optText,
	type Row,
	row,
	rows,
	text,
	units,
} from "../store/index.js";
import { type Task, TaskState } from "./types.js";

const STATES: readonly TaskState[] = Object.values(TaskState);

const toTask = (record: Row): Task => ({
	id: text(record, "id"),
	orderId: text(record, "order_id"),
	firmId: text(record, "firm_id"),
	sourceLang: text(record, "source_lang"),
	targetLang: text(record, "target_lang"),
	text: text(record, "text"),
	draft: text(record, "draft"),
	result: optText(record, "result"),
	reason: optText(record, "reason"),
	state: oneOf(record, "state", STATES),
	priceUnits: units(record, "price_units"),
	refundWallet: text(record, "refund_wallet"),
	linguistId: optText(record, "linguist_id"),
	linguistWallet: optText(record, "linguist_wallet"),
	agencyId: optText(record, "agency_id"),
	agencyWallet: optText(record, "agency_wallet"),
	claimDeadline: int(record, "claim_deadline"),
	workDeadline: optInt(record, "work_deadline"),
	createdAt: int(record, "created_at"),
	updatedAt: int(record, "updated_at"),
});

export const oneTask = (value: unknown): Task | null => {
	const found = row(value);
	return found ? toTask(found) : null;
};

export const manyTasks = (values: unknown[]): Task[] =>
	rows(values).map(toTask);
