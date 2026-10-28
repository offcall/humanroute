// drafts rows: insert with the order price, read back with targets validated (ADR 0022).
import { asRow, int, optText, type Row, text, units } from "../tasks/index.js";
import { isRecord } from "./body.js";
import { ORDERS_SQL } from "./sql.js";
import type { Draft, DraftBody, DraftTarget, OrdersDeps } from "./types.js";

const parseTargets = (json: string): DraftTarget[] => {
	const raw: unknown = JSON.parse(json);
	if (!Array.isArray(raw)) {
		throw new Error("drafts.targets_json is not an array");
	}
	return raw.map((item: unknown) => {
		if (
			!isRecord(item) ||
			typeof item.targetLang !== "string" ||
			typeof item.draft !== "string"
		) {
			throw new Error("drafts.targets_json has a malformed target");
		}
		return { targetLang: item.targetLang, draft: item.draft };
	});
};

const toDraft = (record: Row): Draft => ({
	id: text(record, "id"),
	firmId: text(record, "firm_id"),
	text: text(record, "text"),
	sourceLang: text(record, "source_lang"),
	targets: parseTargets(text(record, "targets_json")),
	metaJson: optText(record, "meta_json"),
	priceUnits: units(record, "price_units"),
	totalUnits: units(record, "total_units"),
	taskCount: int(record, "task_count"),
	createdAt: int(record, "created_at"),
	orderId: optText(record, "order_id"),
});

// totalUnits = taskCount x taskPriceUnits (bigint).
export const insertDraft = (
	deps: OrdersDeps,
	firmId: string,
	body: DraftBody,
): Draft => {
	const taskCount = body.targets.length;
	const draft: Draft = {
		...body,
		id: deps.newId(),
		firmId,
		priceUnits: deps.taskPriceUnits,
		totalUnits: BigInt(taskCount) * deps.taskPriceUnits,
		taskCount,
		createdAt: deps.now(),
		orderId: null,
	};
	deps.database
		.prepare(ORDERS_SQL.insertDraft)
		.run(
			draft.id,
			firmId,
			draft.text,
			draft.sourceLang,
			JSON.stringify(draft.targets),
			draft.metaJson,
			draft.priceUnits.toString(),
			draft.totalUnits.toString(),
			taskCount,
			draft.createdAt,
		);
	return draft;
};

// null when unknown, or unpaid and older than DRAFT_TTL_SECONDS.
export const draftById = (deps: OrdersDeps, draftId: string): Draft | null => {
	const found = asRow(deps.database.prepare(ORDERS_SQL.draftById).get(draftId));
	if (!found) {
		return null;
	}
	const draft = toDraft(found);
	const expired = draft.createdAt + deps.draftTtlSeconds * 1000 <= deps.now();
	return draft.orderId === null && expired ? null : draft;
};
