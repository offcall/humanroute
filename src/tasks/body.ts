// Request bodies of the task routes, called with the session cookie or the MCP Bearer token (ADR 0030).
// A body needs content-type application/json, the CSRF guard for cookie callers (api.md).
import type { Context } from "hono";

export const MAX_RESULT_LENGTH = 20_000;
export const MAX_REASON_LENGTH = 1_000;

export type JsonBody = { ok: true; value: unknown } | { ok: false };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

// The media type essence must be application/json (any case, parameters allowed), the CSRF guard.
const JSON_TYPE = /^application\/json[ \t]*(;|$)/i;

export const hasJsonType = (ctx: Context): boolean =>
	JSON_TYPE.test(ctx.req.header("content-type") ?? "");

export const readJson = async (ctx: Context): Promise<JsonBody> => {
	if (!hasJsonType(ctx)) {
		return { ok: false };
	}
	try {
		const value: unknown = await ctx.req.json();
		return { ok: true, value };
	} catch {
		return { ok: false };
	}
};

// Non-empty translation result, or null.
export const parseResult = (raw: unknown): string | null => {
	if (!isRecord(raw) || typeof raw.result !== "string") {
		return null;
	}
	const { result } = raw;
	return result.trim() !== "" && result.length <= MAX_RESULT_LENGTH
		? result
		: null;
};

// Trimmed reject reason of 1..1000 chars, or null (422 reason_required).
export const parseReason = (raw: unknown): string | null => {
	if (!isRecord(raw) || typeof raw.reason !== "string") {
		return null;
	}
	const reason = raw.reason.trim();
	return reason.length >= 1 && reason.length <= MAX_REASON_LENGTH
		? reason
		: null;
};
