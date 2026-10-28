// Body of POST /api/orders/draft (api.md), validated before anything is stored or priced.
import type { DraftBody, DraftTarget } from "./types.js";

export const MAX_TEXT_LENGTH = 5_000;
const MAX_TARGETS = 5;
const LANG = /^[a-z]{2}$/;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const parseTarget = (raw: unknown, sourceLang: string): DraftTarget | null => {
	if (!isRecord(raw)) {
		return null;
	}
	const { targetLang, draft } = raw;
	if (typeof targetLang !== "string" || !LANG.test(targetLang)) {
		return null;
	}
	if (targetLang === sourceLang || typeof draft !== "string") {
		return null;
	}
	return draft.length <= MAX_TEXT_LENGTH ? { targetLang, draft } : null;
};

const parseTargets = (
	raw: unknown,
	sourceLang: string,
): DraftTarget[] | null => {
	if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_TARGETS) {
		return null;
	}
	const targets: DraftTarget[] = [];
	for (const item of raw) {
		const target = parseTarget(item, sourceLang);
		if (target === null) {
			return null;
		}
		targets.push(target);
	}
	const langs = new Set(targets.map((target) => target.targetLang));
	return langs.size === targets.length ? targets : null;
};

// The validated draft, or null (422 invalid_body).
export const parseDraftBody = (raw: unknown): DraftBody | null => {
	if (!isRecord(raw)) {
		return null;
	}
	const { text, sourceLang, meta } = raw;
	if (typeof text !== "string" || text.trim() === "") {
		return null;
	}
	if (text.length > MAX_TEXT_LENGTH) {
		return null;
	}
	if (typeof sourceLang !== "string" || !LANG.test(sourceLang)) {
		return null;
	}
	if (meta !== undefined && meta !== null && !isRecord(meta)) {
		return null;
	}
	const targets = parseTargets(raw.targets, sourceLang);
	if (targets === null) {
		return null;
	}
	const metaJson = isRecord(meta) ? JSON.stringify(meta) : null;
	return { text, sourceLang, targets, metaJson };
};
