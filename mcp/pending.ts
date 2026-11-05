// Unsigned payments between prepare_payment and pay_task, in process memory only (ADR 0036).
// One MCP instance runs; after a restart Claude calls prepare_payment again.
import type { Prepared } from "./payTypes.js";

export const PREPARED_TTL_MS = 120_000;

const prepared = new Map<string, Prepared>();

const keyOf = (token: string, draftId: string) => `${token}:${draftId}`;

export const keepPrepared = (
	token: string,
	draftId: string,
	value: Prepared,
	now: number,
) => {
	for (const [key, entry] of prepared) {
		if (entry.expiresAt <= now) {
			prepared.delete(key);
		}
	}
	prepared.set(keyOf(token, draftId), value);
};

export const takePrepared = (
	token: string,
	draftId: string,
	now: number,
): Prepared | undefined => {
	const entry = prepared.get(keyOf(token, draftId));
	return entry !== undefined && entry.expiresAt > now ? entry : undefined;
};

export const dropPrepared = (token: string, draftId: string) => {
	prepared.delete(keyOf(token, draftId));
};
