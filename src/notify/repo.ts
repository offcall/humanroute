// push_subscriptions reads and writes. Only this file runs the notify SQL.
import { type Database, rows, text } from "../store/index.js";
import { PUSH_SQL } from "./sql.js";
import type { PushTarget } from "./types.js";

export const saveSubscription = (
	database: Database,
	linguistId: string,
	target: PushTarget,
	now: number,
): void => {
	database
		.prepare(PUSH_SQL.upsert)
		.run(target.endpoint, linguistId, target.p256dh, target.auth, now);
};

export const removeSubscription = (
	database: Database,
	endpoint: string,
): void => {
	database.prepare(PUSH_SQL.remove).run(endpoint);
};

export const subscriptionsOf = (
	database: Database,
	linguistIds: string[],
): PushTarget[] =>
	rows(
		database.prepare(PUSH_SQL.byLinguists).all(JSON.stringify(linguistIds)),
	).map((record) => ({
		endpoint: text(record, "endpoint"),
		p256dh: text(record, "p256dh"),
		auth: text(record, "auth"),
	}));
