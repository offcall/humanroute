// Request body for POST /x/translate, validated before any price is quoted.
import type { TranslateBody, TranslateMeta } from "./types.js";

export const MAX_TEXT_LENGTH = 5_000;
const LANG = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const parseMeta = (raw: unknown): TranslateMeta | null | string => {
	if (raw === undefined || raw === null) {
		return null;
	}
	if (!isRecord(raw)) {
		return "meta must be an object";
	}
	const meta: TranslateMeta = {};
	const { clauseId, confidence } = raw;
	if (clauseId !== undefined) {
		if (typeof clauseId !== "string" || clauseId.length > 100) {
			return "meta.clauseId must be a short string";
		}
		meta.clauseId = clauseId;
	}
	if (confidence !== undefined) {
		if (
			typeof confidence !== "number" ||
			!(confidence >= 0 && confidence <= 1)
		) {
			return "meta.confidence must be a number between 0 and 1";
		}
		meta.confidence = confidence;
	}
	return meta;
};

export const parseTranslateBody = (raw: unknown): TranslateBody | string => {
	if (!isRecord(raw)) {
		return "body must be a JSON object";
	}
	const { text, sourceLang, targetLang, draft } = raw;
	if (typeof text !== "string" || text.trim() === "") {
		return "text is required";
	}
	if (text.length > MAX_TEXT_LENGTH) {
		return `text too long (max ${MAX_TEXT_LENGTH})`;
	}
	if (typeof sourceLang !== "string" || !LANG.test(sourceLang)) {
		return "sourceLang must be a language code";
	}
	if (typeof targetLang !== "string" || !LANG.test(targetLang)) {
		return "targetLang must be a language code";
	}
	if (draft !== undefined && draft !== null && typeof draft !== "string") {
		return "draft must be a string";
	}
	if (typeof draft === "string" && draft.length > MAX_TEXT_LENGTH) {
		return `draft too long (max ${MAX_TEXT_LENGTH})`;
	}
	const meta = parseMeta(raw.meta);
	if (typeof meta === "string") {
		return meta;
	}
	return {
		text,
		sourceLang,
		targetLang,
		draft: typeof draft === "string" ? draft : null,
		meta,
	};
};
