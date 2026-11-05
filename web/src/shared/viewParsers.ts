// Response wrappers with the ADR 0033 read fields.
import { parseOrder } from "./boardParsers";
import { arr, isRecord, num, orNull, str } from "./parse";
import { parseAgency, parsePair } from "./parsers";
import { parseTask } from "./taskParsers";

// GET /api/orders
export const parseOrders = (raw: unknown) => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const serverTime = str(raw.serverTime);
	const orders = arr(raw.orders, parseOrder);

	return serverTime === undefined || orders === undefined
		? undefined
		: { serverTime, orders };
};

// GET /api/orders/:id
export const parseOrderView = (raw: unknown) => {
	const order = parseOrder(raw);
	const serverTime = isRecord(raw) ? str(raw.serverTime) : undefined;

	return order === undefined || serverTime === undefined
		? undefined
		: { serverTime, order };
};

// GET /api/tasks/:id; executorPairs only for the owner firm
export const parseTaskDetail = (raw: unknown) => {
	const task = parseTask(raw);
	if (task === undefined || !isRecord(raw)) {
		return undefined;
	}
	const serverTime = str(raw.serverTime);
	const executorPairs = orNull(raw.executorPairs, (value) =>
		arr(value, parsePair),
	);

	return serverTime === undefined || executorPairs === undefined
		? undefined
		: { serverTime, task, executorPairs };
};

// The linguist's own agency and number on GET /api/linguist
export const parseLinguistSelf = (raw: unknown) => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const agency = parseAgency(raw.agency);
	const translatorNo = num(raw.translatorNo);

	return agency === undefined || translatorNo === undefined
		? undefined
		: { agency, translatorNo };
};

// GET /api/linguist/join/:inviteCode
export const parseJoinPreview = (raw: unknown) => {
	const agency = isRecord(raw) ? parseAgency(raw.agency) : undefined;

	return agency === undefined ? undefined : { agency };
};
