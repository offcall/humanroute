// Push subscription bodies (ADR 0029): the gateway posts only to known push services (SSRF guard).
import { describe, expect, test } from "vitest";
import { parseEndpoint, parseSubscription } from "./body.js";

const KEYS = {
	p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA",
	auth: "tBHItJI5svbpez7KI4CCXg",
};

const subscription = (
	endpoint: string,
	keys: Record<string, string> = KEYS,
) => ({
	endpoint,
	keys,
});

describe("push subscription body parser (SSRF guard)", () => {
	test.each([
		"https://web.push.apple.com/QGuQyavXutnMH",
		"https://api.push.apple.com/3/device/abc",
		"https://fcm.googleapis.com/fcm/send/device-1",
		"https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
		"https://eu.push.services.mozilla.com/wpush/v2/gAAAA",
		"https://wns2-par02p.notify.windows.com/w/?token=BQYAAA",
		"https://fcm.googleapis.com:443/fcm/send/device-1",
	])("accepts %s", (endpoint) => {
		expect(parseSubscription(subscription(endpoint))).toEqual({
			endpoint,
			...KEYS,
		});
	});

	test.each([
		"http://fcm.googleapis.com/fcm/send/device-1",
		"https://fcm.googleapis.com:8443/fcm/send/device-1",
		"https://example.com/push",
		"https://fcm.googleapis.com@evil.com/push",
		"https://fcm.googleapis.com.evil.com/push",
		"https://evilpush.apple.com/push",
		`https://fcm.googleapis.com/${"a".repeat(2049 - "https://fcm.googleapis.com/".length)}`,
		"not a url",
	])("refuses %s", (endpoint) => {
		expect(parseSubscription(subscription(endpoint))).toBeNull();
		expect(parseEndpoint({ endpoint })).toBeNull();
	});

	test("accepts an endpoint of exactly 2048 characters", () => {
		const base = "https://fcm.googleapis.com/";
		const endpoint = `${base}${"a".repeat(2048 - base.length)}`;
		expect(parseEndpoint({ endpoint })).toBe(endpoint);
	});

	const ENDPOINT = "https://fcm.googleapis.com/fcm/send/device-1";

	test.each([
		["empty p256dh", { ...KEYS, p256dh: "" }, false],
		["invalid characters", { ...KEYS, auth: "abc+/def" }, false],
		["257 characters", { ...KEYS, p256dh: "a".repeat(257) }, false],
		["256 characters", { ...KEYS, p256dh: "a".repeat(256) }, true],
		["two trailing =", { ...KEYS, auth: "abcd==" }, true],
		["three trailing =", { ...KEYS, auth: "abcd===" }, false],
	])("keys: %s", (_name, keys, accepted) => {
		const parsed = parseSubscription(subscription(ENDPOINT, keys));
		expect(parsed !== null).toBe(accepted);
	});

	test("unsubscribe needs only a valid endpoint", () => {
		expect(parseEndpoint({ endpoint: ENDPOINT })).toBe(ENDPOINT);
		expect(parseEndpoint({ endpoint: ENDPOINT, keys: "ignored" })).toBe(
			ENDPOINT,
		);
		expect(parseEndpoint({})).toBeNull();
		expect(parseSubscription({ endpoint: ENDPOINT })).toBeNull();
	});
});
