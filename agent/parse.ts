// Hand-written parsers for the JSON the agent receives from the gateway.
import type { Accepted, JobStatus, Parsed, Transfer } from "./types.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmpty = (value: unknown): value is string =>
	typeof value === "string" && value.length > 0;

const nullableString = (value: unknown): string | null | undefined => {
	if (value === null || value === undefined) {
		return null;
	}
	return typeof value === "string" ? value : undefined;
};

export const parseAccepted = (raw: unknown): Parsed<Accepted> => {
	if (!isRecord(raw)) {
		return { ok: false, error: "accepted body is not an object" };
	}
	const { jobId, statusUrl, statusToken } = raw;
	if (!isNonEmpty(jobId)) {
		return { ok: false, error: "jobId missing" };
	}
	if (!isNonEmpty(statusUrl)) {
		return { ok: false, error: "statusUrl missing" };
	}
	if (!isNonEmpty(statusToken)) {
		return { ok: false, error: "statusToken missing" };
	}
	return { ok: true, value: { jobId, statusUrl, statusToken } };
};

const parseTransfer = (raw: unknown): Transfer | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const txSig = nullableString(raw.tx_sig);
	if (!isNonEmpty(raw.kind) || !isNonEmpty(raw.status) || txSig === undefined) {
		return undefined;
	}
	const transfer: Transfer = { kind: raw.kind, status: raw.status, txSig };
	// attempts and last_error are optional: older gateways do not send them.
	if (raw.attempts !== undefined) {
		if (typeof raw.attempts !== "number" || !Number.isInteger(raw.attempts)) {
			return undefined;
		}
		transfer.attempts = raw.attempts;
	}
	if (raw.last_error !== undefined) {
		const lastError = nullableString(raw.last_error);
		if (lastError === undefined) {
			return undefined;
		}
		transfer.lastError = lastError;
	}
	return transfer;
};

const parseTransfers = (raw: unknown): Transfer[] | undefined => {
	if (!Array.isArray(raw)) {
		return undefined;
	}
	const out: Transfer[] = [];
	for (const item of raw) {
		const transfer = parseTransfer(item);
		if (!transfer) {
			return undefined;
		}
		out.push(transfer);
	}
	return out;
};

export const parseStatus = (raw: unknown): Parsed<JobStatus> => {
	if (!isRecord(raw)) {
		return { ok: false, error: "status body is not an object" };
	}
	const refundReason = nullableString(raw.refund_reason);
	const answer = nullableString(raw.answer);
	const transfers = parseTransfers(raw.transfers);
	if (!isNonEmpty(raw.state)) {
		return { ok: false, error: "state missing" };
	}
	if (refundReason === undefined) {
		return { ok: false, error: "refund_reason is not a string" };
	}
	if (answer === undefined) {
		return { ok: false, error: "answer is not a string" };
	}
	if (!transfers) {
		return { ok: false, error: "transfers malformed" };
	}
	const viewed = raw.viewed_at !== null && raw.viewed_at !== undefined;
	return {
		ok: true,
		value: { state: raw.state, refundReason, viewed, answer, transfers },
	};
};
