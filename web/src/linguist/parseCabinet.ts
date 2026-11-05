import {
	type Agency,
	arr,
	isRecord,
	type LanguagePair,
	parseAmount,
	parseLinguistSelf,
	parsePair,
	parseTask,
	type Task,
} from "../shared";

export type Cabinet = {
	agency: Agency;
	translatorNo: number;
	pairs: LanguagePair[];
	earnedUnits: bigint;
	tasks: Task[];
};

export const parseCabinet = (raw: unknown): Cabinet | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const self = parseLinguistSelf(raw);
	const pairs = arr(raw.pairs, parsePair);
	const earnedUnits = parseAmount(raw.earnedUnits);
	const tasks = arr(raw.tasks, parseTask);
	if (self === undefined || pairs === undefined) {
		return undefined;
	}
	if (earnedUnits === undefined || tasks === undefined) {
		return undefined;
	}

	return { ...self, pairs, earnedUnits, tasks };
};

export const parsePairs = (raw: unknown): true | undefined =>
	isRecord(raw) ? true : undefined;
