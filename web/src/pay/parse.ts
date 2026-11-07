import { isRecord } from "../shared";
import {
	DraftState,
	type DraftView,
	type Parsed,
	type PayResult,
} from "./types";

const fail = (error: string): { ok: false; error: string } => ({
	ok: false,
	error,
});

const stateOf = (value: unknown): DraftState | undefined =>
	Object.values(DraftState).find((state) => state === value);

const unitsOf = (value: unknown): bigint | undefined =>
	typeof value === "string" && /^\d+$/.test(value) ? BigInt(value) : undefined;

const stringsOf = (value: unknown): string[] | undefined => {
	if (!Array.isArray(value)) {
		return undefined;
	}
	const items: string[] = [];
	for (const item of value) {
		if (typeof item !== "string") {
			return undefined;
		}
		items.push(item);
	}

	return items;
};

export const parseDraftView = (input: unknown): Parsed<DraftView> => {
	if (!isRecord(input)) {
		return fail("draft is not an object");
	}
	const { draftId, sourceLang, taskCount, payTo, mint, network } = input;
	const state = stateOf(input.state);
	const targetLangs = stringsOf(input.targetLangs);
	const priceUnits = unitsOf(input.priceUnits);
	const totalUnits = unitsOf(input.totalUnits);
	if (
		typeof draftId !== "string" ||
		state === undefined ||
		typeof sourceLang !== "string" ||
		typeof taskCount !== "number" ||
		typeof payTo !== "string" ||
		typeof mint !== "string" ||
		typeof network !== "string" ||
		targetLangs === undefined ||
		priceUnits === undefined ||
		totalUnits === undefined
	) {
		return fail("draft has an unexpected shape");
	}
	const view: DraftView = {
		draftId,
		state,
		sourceLang,
		targetLangs,
		taskCount,
		priceUnits,
		totalUnits,
		payTo,
		mint,
		network,
	};
	if (typeof input.orderId === "string") {
		view.orderId = input.orderId;
	}
	if (typeof input.payTx === "string" || input.payTx === null) {
		view.payTx = input.payTx;
	}

	return { ok: true, value: view };
};

export const parsePayResult = (input: unknown): Parsed<PayResult> => {
	if (!isRecord(input)) {
		return fail("payment result is not an object");
	}
	const { orderId, payTx } = input;
	const taskIds = stringsOf(input.taskIds);
	if (
		typeof orderId !== "string" ||
		typeof payTx !== "string" ||
		taskIds === undefined
	) {
		return fail("payment result has an unexpected shape");
	}

	return { ok: true, value: { orderId, taskIds, payTx } };
};
