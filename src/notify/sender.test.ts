// The web-push adapter (ADR 0029) with sendNotification replaced: no network.

import { afterEach, describe, expect, it, vi } from "vitest";
import webpush from "web-push";
import { createPushSender } from "./sender.js";

const VAPID = {
	publicKey: "vapid-public",
	privateKey: "vapid-private",
	subject: "mailto:ops@humanroute.test",
};
const TARGET = {
	endpoint: "https://fcm.googleapis.com/fcm/send/device-1",
	p256dh: "p256dh-1",
	auth: "auth-1",
};

const pushError = (status: number, body: string) =>
	new webpush.WebPushError("push refused", status, {}, body, TARGET.endpoint);

const failWith = (err: unknown) =>
	vi.spyOn(webpush, "sendNotification").mockRejectedValue(err);

afterEach(() => {
	vi.restoreAllMocks();
});

describe("createPushSender", () => {
	it("NT-12 sends with TTL, urgency high and the VAPID details", async () => {
		const spy = vi
			.spyOn(webpush, "sendNotification")
			.mockResolvedValue({ statusCode: 201, body: "", headers: {} });

		const outcome = await createPushSender(VAPID)(TARGET, '{"taskId":"t"}', 60);

		expect(outcome).toEqual({ kind: "sent" });
		expect(spy).toHaveBeenCalledWith(
			{
				endpoint: TARGET.endpoint,
				keys: { p256dh: "p256dh-1", auth: "auth-1" },
			},
			'{"taskId":"t"}',
			{ vapidDetails: VAPID, TTL: 60, urgency: "high" },
		);
	});

	it.each([404, 410])("NT-13 a WebPushError %i is gone", async (status) => {
		failWith(pushError(status, "expired"));
		expect(await createPushSender(VAPID)(TARGET, "{}", 60)).toEqual({
			kind: "gone",
		});
	});

	it("NT-13 another WebPushError fails with its status and a short one-line reason", async () => {
		const body = `{"reason":\n  "BadJwtToken"}   ${"x".repeat(200)}`;
		failWith(pushError(403, body));

		const outcome = await createPushSender(VAPID)(TARGET, "{}", 60);

		const reason = `{"reason": "BadJwtToken"} ${"x".repeat(200)}`.slice(0, 120);
		expect(outcome).toEqual({ kind: "failed", status: 403, reason });
	});

	it("NT-13 a non-WebPushError fails with status null", async () => {
		failWith(new Error("getaddrinfo ENOTFOUND"));
		expect(await createPushSender(VAPID)(TARGET, "{}", 60)).toEqual({
			kind: "failed",
			status: null,
			reason: "getaddrinfo ENOTFOUND",
		});
	});
});
