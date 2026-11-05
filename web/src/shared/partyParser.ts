import { isRecord, num, orNull, str } from "./parse";
import { parseAgency } from "./parsers";
import type { TaskParties } from "./types";

// firmName, agency and translatorNo of a TaskView (ADR 0033)
export const parseParties = (raw: unknown): TaskParties | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const firmName = str(raw.firmName);
	const agency = orNull(raw.agency, parseAgency);
	const translatorNo = orNull(raw.translatorNo, num);
	if (
		firmName === undefined ||
		agency === undefined ||
		translatorNo === undefined
	) {
		return undefined;
	}

	return { firmName, agency, translatorNo };
};
