// Request fingerprint: sha256 over the validated body in a fixed field order, so key order and
// unknown fields in the client JSON do not change it. Same payment + different fingerprint -> 409.
import { createHash } from "node:crypto";
import type { TranslateBody } from "./types.js";

export const fingerprint = (body: TranslateBody): string => {
	const normalized = [
		body.text,
		body.sourceLang,
		body.targetLang,
		body.draft,
		body.meta === null
			? null
			: [body.meta.clauseId ?? null, body.meta.confidence ?? null],
	];
	return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
};
