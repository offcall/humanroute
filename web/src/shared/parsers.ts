import { isRecord, orNull, str } from "./parse";
import type { Agency, Firm, LanguagePair, Linguist, Me } from "./types";

export const parseFirm = (raw: unknown): Firm | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const firmId = str(raw.id);
	const name = str(raw.name);

	return firmId === undefined || name === undefined
		? undefined
		: { id: firmId, name };
};

export const parseAgency = (raw: unknown): Agency | undefined => parseFirm(raw);

export const parseLinguist = (raw: unknown): Linguist | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const linguistId = str(raw.id);
	const agencyId = str(raw.agencyId);

	return linguistId === undefined || agencyId === undefined
		? undefined
		: { id: linguistId, agencyId };
};

export const parsePair = (raw: unknown): LanguagePair | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const source = str(raw.source);
	const target = str(raw.target);

	return source === undefined || target === undefined
		? undefined
		: { source, target };
};

export const parseMe = (raw: unknown): Me | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const wallet = str(raw.wallet);
	const firm = orNull(raw.firm, parseFirm);
	const agency = orNull(raw.agency, parseAgency);
	const linguist = orNull(raw.linguist, parseLinguist);
	if (wallet === undefined || firm === undefined) {
		return undefined;
	}
	if (agency === undefined || linguist === undefined) {
		return undefined;
	}

	return { wallet, firm, agency, linguist };
};
