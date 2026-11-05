import { parseAmount } from "./money";
import { isRecord, num, orNull, str } from "./parse";
import type { Transfer } from "./types";

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
	const confirmedAt = orNull(raw.confirmedAt, str);
	const earnedUnits = orNull(raw.earnedUnits, parseAmount);
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
	if (confirmedAt === undefined || earnedUnits === undefined) {
		return undefined;
	}

	return {
		status,
		payTx,
		memo,
		attempts,
		lastError,
		explorerUrl,
		confirmedAt,
		earnedUnits,
	};
};
