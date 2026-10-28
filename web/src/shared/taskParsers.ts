import { parseAmount } from "./money";
import { isRecord, num, orNull, str } from "./parse";
import { type Task, TaskState, type Transfer } from "./types";

export const parseState = (raw: unknown): TaskState | undefined => {
	for (const state of Object.values(TaskState)) {
		if (state === raw) {
			return state;
		}
	}

	return undefined;
};

export const parseTransfer = (raw: unknown): Transfer | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const status = str(raw.status);
	const memo = str(raw.memo);
	const attempts = num(raw.attempts);
	const payTx = orNull(raw.payTx, str);
	const lastError = orNull(raw.lastError, str);
	const explorerUrl = orNull(raw.explorerUrl, str);
	if (status === undefined || memo === undefined || attempts === undefined) {
		return undefined;
	}
	if (
		payTx === undefined ||
		lastError === undefined ||
		explorerUrl === undefined
	) {
		return undefined;
	}

	return { status, payTx, memo, attempts, lastError, explorerUrl };
};

export const parseTask = (raw: unknown): Task | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const taskId = str(raw.taskId);
	const orderId = str(raw.orderId);
	const sourceLang = str(raw.sourceLang);
	const targetLang = str(raw.targetLang);
	const text = str(raw.text);
	const draft = str(raw.draft);
	const state = parseState(raw.state);
	const publicState = str(raw.publicState);
	const priceUnits = parseAmount(raw.priceUnits);
	const claimDeadline = str(raw.claimDeadline);
	const result = orNull(raw.result, str);
	const workDeadline = orNull(raw.workDeadline, str);
	const reason = orNull(raw.reason, str);
	const transfer = orNull(raw.transfer, parseTransfer);
	if (
		taskId === undefined ||
		orderId === undefined ||
		sourceLang === undefined
	) {
		return undefined;
	}
	if (targetLang === undefined || text === undefined || draft === undefined) {
		return undefined;
	}
	if (
		state === undefined ||
		publicState === undefined ||
		priceUnits === undefined
	) {
		return undefined;
	}
	if (
		claimDeadline === undefined ||
		result === undefined ||
		workDeadline === undefined
	) {
		return undefined;
	}
	if (reason === undefined || transfer === undefined) {
		return undefined;
	}

	return {
		taskId,
		orderId,
		sourceLang,
		targetLang,
		text,
		draft,
		result,
		state,
		publicState,
		priceUnits,
		claimDeadline,
		workDeadline,
		reason,
		transfer,
	};
};
