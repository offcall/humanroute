import {
	type Draft,
	DraftState,
	type DraftStatus,
	type Parsed,
} from "./types.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const stateOf = (value: unknown): DraftState | undefined =>
	Object.values(DraftState).find((state) => state === value);

const isUnits = (value: unknown): value is string =>
	typeof value === "string" && /^\d+$/.test(value);

export const parseDraft = (input: unknown): Parsed<Draft> => {
	if (!isRecord(input)) {
		return { ok: false, error: "gateway draft is not an object" };
	}
	const { draftId, payUrl, priceUnits, totalUnits, taskCount } = input;
	if (
		typeof draftId !== "string" ||
		typeof payUrl !== "string" ||
		!isUnits(priceUnits) ||
		!isUnits(totalUnits) ||
		typeof taskCount !== "number"
	) {
		return { ok: false, error: "gateway draft has an unexpected shape" };
	}

	return {
		ok: true,
		value: { draftId, payUrl, priceUnits, totalUnits, taskCount },
	};
};

export const parseDraftStatus = (input: unknown): Parsed<DraftStatus> => {
	if (!isRecord(input)) {
		return { ok: false, error: "gateway status is not an object" };
	}
	const { draftId, orderId, tasks } = input;
	const state = stateOf(input.state);
	if (typeof draftId !== "string" || state === undefined) {
		return { ok: false, error: "gateway status has an unexpected shape" };
	}
	const status: DraftStatus = { draftId, state };
	if (typeof orderId === "string") {
		status.orderId = orderId;
	}
	if (Array.isArray(tasks)) {
		status.tasks = tasks;
	}

	return { ok: true, value: status };
};
