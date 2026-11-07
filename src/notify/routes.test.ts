// Push subscribe and unsubscribe routes (ADR 0029).
import { describe, expect, it } from "vitest";
import {
	createTestGateway,
	expectJson,
	joinLinguist,
	registerAgency,
	registerFirm,
	send,
	WALLETS,
} from "../testing/index.js";

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/device-1";
const BODY = {
	endpoint: ENDPOINT,
	keys: {
		p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA",
		auth: "tBHItJI5svbpez7KI4CCXg",
	},
};

describe("push routes", () => {
	it("NEW-19 push subscription endpoints enforce roles and validate bodies while unsubscribe stays idempotent", async () => {
		const { app, database } = createTestGateway();
		const firm = await registerFirm(app, WALLETS.firm);
		const agency = await registerAgency(app, WALLETS.agency);
		const linguist = await joinLinguist(
			app,
			WALLETS.linguist,
			agency.inviteCode,
			[{ source: "en", target: "es" }],
		);
		const subscribe = (cookie: string | undefined, body: unknown) =>
			send(app, "POST", "/api/push/subscribe", {
				body,
				...(cookie === undefined ? {} : { cookie }),
			});
		const count = () =>
			database.prepare("SELECT COUNT(*) FROM push_subscriptions").pluck().get();

		expect((await subscribe(undefined, BODY)).status).toBe(401);
		expect((await subscribe(firm.cookie, BODY)).status).toBe(403);
		expect((await subscribe(agency.cookie, BODY)).status).toBe(403);
		const text = await app.request("/api/push/subscribe", {
			method: "POST",
			headers: { cookie: linguist, "content-type": "text/plain" },
			body: JSON.stringify(BODY),
		});
		expect(await expectJson(text, 400)).toEqual({ error: "malformed_body" });
		const badEndpoint = { ...BODY, endpoint: "https://evil.example/push" };
		expect(
			await expectJson(await subscribe(linguist, badEndpoint), 422),
		).toEqual({
			error: "invalid_body",
		});
		const badKey = { ...BODY, keys: { ...BODY.keys, auth: "" } };
		expect((await subscribe(linguist, badKey)).status).toBe(422);
		expect(count()).toBe(0);
		expect((await subscribe(linguist, BODY)).status).toBe(204);
		expect(count()).toBe(1);

		const unsubscribe = (body: unknown) =>
			send(app, "POST", "/api/push/unsubscribe", { body });
		expect(
			(await unsubscribe({ endpoint: "https://evil.example/push" })).status,
		).toBe(422);
		expect((await unsubscribe({ endpoint: ENDPOINT })).status).toBe(204);
		expect(count()).toBe(0);
		expect((await unsubscribe({ endpoint: ENDPOINT })).status).toBe(204);
	});
});
