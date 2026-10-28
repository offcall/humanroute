import { parseAmount } from "./money";
import { isRecord, num, orNull, str } from "./parse";
import type { AgencyRating, FirmRating } from "./types";

export const parseAgencyRating = (raw: unknown): AgencyRating | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const agencyId = str(raw.agencyId);
	const ratingPct = orNull(raw.ratingPct, num);
	const approved = num(raw.approved);
	const rejected = num(raw.rejected);
	const late = num(raw.late);
	const paidUnits = parseAmount(raw.paidUnits);
	if (
		agencyId === undefined ||
		ratingPct === undefined ||
		approved === undefined
	) {
		return undefined;
	}
	if (rejected === undefined || late === undefined || paidUnits === undefined) {
		return undefined;
	}

	return { agencyId, ratingPct, approved, rejected, late, paidUnits };
};

export const parseFirmRating = (raw: unknown): FirmRating | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const firmId = str(raw.firmId);
	const rejectPct = orNull(raw.rejectPct, num);
	const approved = num(raw.approved);
	const rejected = num(raw.rejected);
	const spentUnits = parseAmount(raw.spentUnits);
	const refundedUnits = parseAmount(raw.refundedUnits);
	if (
		firmId === undefined ||
		rejectPct === undefined ||
		approved === undefined
	) {
		return undefined;
	}
	if (
		rejected === undefined ||
		spentUnits === undefined ||
		refundedUnits === undefined
	) {
		return undefined;
	}

	return { firmId, rejectPct, approved, rejected, spentUnits, refundedUnits };
};
