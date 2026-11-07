// Request body parsing for the accounts routes.
import type { Context } from "hono";
import type { LangPair } from "./types.js";

export type JsonBody = { ok: true; value: unknown } | { ok: false };

const LANG = /^[a-z]{2}$/;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
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

export const parseName = (raw: unknown): string | null => {
	if (!isRecord(raw) || typeof raw.name !== "string") {
		return null;
	}
	const name = raw.name.trim();
	return name.length >= 1 && name.length <= 100 ? name : null;
};

export const parsePairs = (raw: unknown): LangPair[] | null => {
	if (!isRecord(raw) || !Array.isArray(raw.pairs)) {
		return null;
	}
	if (raw.pairs.length < 1 || raw.pairs.length > 10) {
		return null;
	}
	const seen = new Set<string>();
	const pairs: LangPair[] = [];
	for (const item of raw.pairs) {
		if (!isRecord(item)) {
			return null;
		}
		const source = item.source;
		const target = item.target;
		if (typeof source !== "string" || typeof target !== "string") {
			return null;
		}
		if (!LANG.test(source) || !LANG.test(target) || source === target) {
			return null;
		}
		const key = `${source}:${target}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		pairs.push({ source, target });
	}
	return pairs;
};
