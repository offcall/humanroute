import {
	type Draft,
	DraftState,
	type DraftStatus,
	type Order,
	type OrderTask,
	type Parsed,
	PublicState,
} from "./types.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isNullableString = (value: unknown): value is string | null =>
	value === null || typeof value === "string";

const isStringArray = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((item) => typeof item === "string");

const stateOf = (value: unknown): DraftState | undefined =>
	Object.values(DraftState).find((state) => state === value);

const publicStateOf = (value: unknown): PublicState | undefined =>
	Object.values(PublicState).find((state) => state === value);

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
	const {
		draftId,
		orderId,
		payUrl,
		priceUnits,
		totalUnits,
		taskCount,
		targetLangs,
	} = input;
	const state = stateOf(input.state);
	if (
		typeof draftId !== "string" ||
		state === undefined ||
		(orderId !== undefined && typeof orderId !== "string") ||
		(payUrl !== undefined && typeof payUrl !== "string") ||
		!isUnits(priceUnits) ||
		!isUnits(totalUnits) ||
		typeof taskCount !== "number" ||
		!isStringArray(targetLangs)
	) {
		return { ok: false, error: "gateway status has an unexpected shape" };
	}
	const status: DraftStatus = {
		draftId,
		state,
		priceUnits,
		totalUnits,
		taskCount,
		targetLangs,
	};
	if (orderId !== undefined) {
		status.orderId = orderId;
	}
	if (payUrl !== undefined) {
		status.payUrl = payUrl;
	}

	return { ok: true, value: status };
};

const parseOrderTask = (input: unknown): OrderTask | undefined => {
	if (!isRecord(input)) {
		return undefined;
	}
	const publicState = publicStateOf(input.publicState);
	const { taskId, targetLang, result, reason, claimDeadline, workDeadline } =
		input;
	if (
		typeof taskId !== "string" ||
		typeof targetLang !== "string" ||
		publicState === undefined ||
		typeof claimDeadline !== "string" ||
		!isNullableString(result) ||
		!isNullableString(reason) ||
		!isNullableString(workDeadline)
	) {
		return undefined;
	}

	return {
		taskId,
		targetLang,
		publicState,
		result,
		reason,
		claimDeadline,
		workDeadline,
	};
};

export const parseTask = (input: unknown): Parsed<OrderTask> => {
	const task = parseOrderTask(input);

	return task === undefined
		? { ok: false, error: "gateway task has an unexpected shape" }
		: { ok: true, value: task };
};

export const parseOrder = (input: unknown): Parsed<Order> => {
	if (!isRecord(input)) {
		return { ok: false, error: "gateway order is not an object" };
	}
	const { orderId, tasks } = input;
	if (typeof orderId !== "string" || !Array.isArray(tasks)) {
		return { ok: false, error: "gateway order has an unexpected shape" };
	}
	const orderTasks = tasks
		.map(parseOrderTask)
		.filter((task): task is OrderTask => task !== undefined);
	if (orderTasks.length !== tasks.length) {
		return { ok: false, error: "gateway order has an unexpected shape" };
	}

	return { ok: true, value: { orderId, tasks: orderTasks } };
};
