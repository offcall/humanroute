// web-push behind the PushSender interface (ADR 0029). Urgency high: a task waits only the claim window.
import webpush from "web-push";
import type { Vapid } from "../config/index.js";
import type { PushSender, SendOutcome } from "./types.js";

const GONE = new Set([404, 410]);

const outcomeOf = (err: unknown): SendOutcome => {
	if (err instanceof webpush.WebPushError) {
		return GONE.has(err.statusCode)
			? { kind: "gone" }
			: { kind: "failed", status: err.statusCode };
	}

	return { kind: "failed", status: null };
};

export const createPushSender =
	(vapid: Vapid): PushSender =>
	async (target, payload, ttlSeconds) => {
		try {
			await webpush.sendNotification(
				{
					endpoint: target.endpoint,
					keys: { p256dh: target.p256dh, auth: target.auth },
				},
				payload,
				{ vapidDetails: vapid, TTL: ttlSeconds, urgency: "high" },
			);
			return { kind: "sent" };
		} catch (err) {
			return outcomeOf(err);
		}
	};
