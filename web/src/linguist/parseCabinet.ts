import {
	arr,
	isRecord,
	type LanguagePair,
	parseAmount,
	parsePair,
	parseTask,
	type Task,
} from "../shared";

export type Cabinet = {
	pairs: LanguagePair[];
	earnedUnits: bigint;
	tasks: Task[];
};

export const parseCabinet = (raw: unknown): Cabinet | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const pairs = arr(raw.pairs, parsePair);
	const earnedUnits = parseAmount(raw.earnedUnits);
	const tasks = arr(raw.tasks, parseTask);
	if (pairs === undefined || earnedUnits === undefined || tasks === undefined) {
		return undefined;
	}

	return { pairs, earnedUnits, tasks };
};

export const parsePairs = (raw: unknown): true | undefined =>
	isRecord(raw) ? true : undefined;
