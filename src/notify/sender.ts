// web-push behind the PushSender interface (ADR 0029). Urgency high: a task waits only the claim window.
import webpush from "web-push";
import type { Vapid } from "../config/index.js";
import type { PushSender, SendOutcome } from "./types.js";

const GONE = new Set([404, 410]);

// The push service body, e.g. Apple's {"reason":"BadJwtToken"}; one short line for the log.
const reasonOf = (body: string): string =>
	body.replace(/\s+/g, " ").trim().slice(0, 120);

const outcomeOf = (err: unknown): SendOutcome => {
	if (err instanceof webpush.WebPushError) {
		return GONE.has(err.statusCode)
			? { kind: "gone" }
			: { kind: "failed", status: err.statusCode, reason: reasonOf(err.body) };
	}

	return {
		kind: "failed",
		status: null,
		reason: err instanceof Error ? err.message : String(err),
	};
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
