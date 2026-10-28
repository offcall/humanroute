import { parseAmount } from "./money";
import { arr, isRecord, str } from "./parse";
import { parseTask } from "./taskParsers";
import type { BoardTask, Order } from "./types";

export const parseBoardTask = (raw: unknown): BoardTask | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const taskId = str(raw.taskId);
	const sourceLang = str(raw.sourceLang);
	const targetLang = str(raw.targetLang);
	const priceUnits = parseAmount(raw.priceUnits);
	const claimDeadline = str(raw.claimDeadline);
	const text = str(raw.text);
	const draft = str(raw.draft);
	if (
		taskId === undefined ||
		sourceLang === undefined ||
		targetLang === undefined
	) {
		return undefined;
	}
	if (priceUnits === undefined || claimDeadline === undefined) {
		return undefined;
	}
	if (text === undefined || draft === undefined) {
		return undefined;
	}

	return {
		taskId,
		sourceLang,
		targetLang,
		priceUnits,
		claimDeadline,
		text,
		draft,
	};
};

export const parseBoard = (raw: unknown) => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const serverTime = str(raw.serverTime);
	const tasks = arr(raw.tasks, parseBoardTask);

	return serverTime === undefined || tasks === undefined
		? undefined
		: { serverTime, tasks };
};

export const parseOrder = (raw: unknown): Order | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const orderId = str(raw.orderId);
	const payTx = str(raw.payTx);
	const totalUnits = parseAmount(raw.totalUnits);
	const createdAt = str(raw.createdAt);
	const tasks = arr(raw.tasks, parseTask);
	if (
		orderId === undefined ||
		payTx === undefined ||
		totalUnits === undefined
	) {
		return undefined;
	}
	if (createdAt === undefined || tasks === undefined) {
		return undefined;
	}

	return { orderId, payTx, totalUnits, createdAt, tasks };
};
