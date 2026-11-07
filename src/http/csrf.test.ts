// CSRF guard for cookie callers (api.md): a state change needs content-type application/json,
// which a cross-site form or no-cors fetch cannot send without a preflight.
import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import {
	createDraft,
	createTestGateway,
	expectJson,
	joinLinguist,
	listField,
	payDraft,
	paymentFor,
	registerAgency,
	registerFirm,
	send,
	signIn,
	testWallet,
	textField,
	WALLETS,
} from "../testing/index.js";

const PAIRS = [
	{ source: "en", target: "es" },
	{ source: "en", target: "fr" },
];

// A firm, an agency, its linguist of both pairs and one paid order (es, fr), both claimed.
const scene = async () => {
	const gateway = createTestGateway();
	const { app } = gateway;
	const firm = await registerFirm(app, WALLETS.firm);
	const agency = await registerAgency(app, WALLETS.agency);
	const linguist = await joinLinguist(
		app,
		WALLETS.linguist,
		agency.inviteCode,
		PAIRS,
	);
	const draftId = textField(await createDraft(app, firm.mcpToken), "draftId");
	const header = await paymentFor(app, draftId, WALLETS.firm, "order-1");
	const paid = await expectJson(await payDraft(app, draftId, header), 201);
	const order = await expectJson(
		await send(app, "GET", `/api/orders/${textField(paid, "orderId")}`, {
			bearer: firm.mcpToken,
		}),
		200,
	);
	const idOf = (lang: string) =>
		textField(
			listField(order, "tasks").find((task) => task.targetLang === lang) ?? {},
			"taskId",
		);
	const tasks = { es: idOf("es"), fr: idOf("fr") };
	for (const taskId of [tasks.es, tasks.fr]) {
		await expectJson(
			await send(app, "POST", `/api/tasks/${taskId}/claim`, {
				cookie: linguist,
				body: {},
			}),
			200,
		);
	}

	return { ...gateway, firm, agency, linguist, tasks };
};

// A request with exactly this content type (none when undefined); a byte body gets no default type.
const raw = (
	app: Hono,
	method: string,
	path: string,
	cookie: string,
	type: string | undefined,
	body: unknown,
) =>
	app.request(path, {
		method,
		headers: {
			cookie,
			...(type === undefined ? {} : { "content-type": type }),
		},
		body: new TextEncoder().encode(JSON.stringify(body)),
	});

const REFUSED = ["text/plain; x=application/json", "text/plain", undefined];

const stateOf = (
	database: ReturnType<typeof createTestGateway>["database"],
	taskId: string,
) =>
	database.prepare("SELECT state FROM tasks WHERE id = ?").pluck().get(taskId);

describe("CSRF content type", () => {
	test("cookie JSON routes require the media type essence application/json", async () => {
		const ctx = await scene();
		const { app, tasks } = ctx;
		const loginId = textField(
			await expectJson(
				await send(app, "POST", "/api/auth/login-request", { body: {} }),
				201,
			),
			"id",
		);
		const fresh = async (seed: number) => signIn(app, testWallet(seed));
		const push = {
			endpoint: "https://fcm.googleapis.com/fcm/send/device-1",
			keys: {
				p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA",
				auth: "tBHItJI5svbpez7KI4CCXg",
			},
		};
		const routes: [string, string, string, unknown, number][] = [
			["POST", "/api/firm", await fresh(51), { name: "Other Firm" }, 201],
			["POST", "/api/agency", await fresh(52), { name: "Other Agency" }, 201],
			["POST", "/api/agency/invite", ctx.agency.cookie, {}, 200],
			[
				"POST",
				`/api/linguist/join/${ctx.agency.inviteCode}`,
				await fresh(53),
				{},
				200,
			],
			["PUT", "/api/linguist/languages", ctx.linguist, { pairs: PAIRS }, 200],
			[
				"POST",
				`/api/tasks/${tasks.es}/submit`,
				ctx.linguist,
				{ result: "Hola" },
				200,
			],
			[
				"POST",
				`/api/tasks/${tasks.es}/reject`,
				ctx.firm.cookie,
				{ reason: "terms" },
				200,
			],
			["POST", "/api/push/subscribe", ctx.linguist, push, 204],
			[
				"POST",
				`/api/auth/login-request/${loginId}/reject`,
				ctx.firm.cookie,
				{},
				204,
			],
			["POST", "/api/auth/logout", await fresh(54), {}, 204],
		];

		for (const [method, path, cookie, body] of routes) {
			for (const type of REFUSED) {
				const res = await raw(app, method, path, cookie, type, body);
				expect([path, type, res.status]).toEqual([path, type, 400]);
			}
		}
		expect(stateOf(ctx.database, tasks.es)).toBe("claimed");

		for (const [method, path, cookie, body, status] of routes) {
			const res = await raw(
				app,
				method,
				path,
				cookie,
				"Application/JSON; charset=utf-8",
				body,
			);
			expect([path, res.status]).toEqual([path, status]);
		}
	});

	test("cookie approve and claim require content-type application/json; Bearer calls do not", async () => {
		const ctx = await scene();
		const { app, tasks } = ctx;
		await expectJson(
			await send(app, "POST", `/api/tasks/${tasks.es}/submit`, {
				cookie: ctx.linguist,
				body: { result: "Hola" },
			}),
			200,
		);
		await expectJson(
			await send(app, "POST", `/api/tasks/${tasks.fr}/submit`, {
				cookie: ctx.linguist,
				body: { result: "Bonjour" },
			}),
			200,
		);
		const draftId = textField(
			await createDraft(app, ctx.firm.mcpToken),
			"draftId",
		);
		const header = await paymentFor(app, draftId, WALLETS.firm, "order-2");
		const paid = await expectJson(await payDraft(app, draftId, header), 201);
		const order = await expectJson(
			await send(app, "GET", `/api/orders/${textField(paid, "orderId")}`, {
				bearer: ctx.firm.mcpToken,
			}),
			200,
		);
		const open = textField(listField(order, "tasks")[0] ?? {}, "taskId");
		const invalid = { error: "invalid_json" };

		const approvePath = `/api/tasks/${tasks.es}/approve`;
		const claimPath = `/api/tasks/${open}/claim`;
		for (const type of REFUSED) {
			const approve = await raw(
				app,
				"POST",
				approvePath,
				ctx.firm.cookie,
				type,
				{},
			);
			expect(await expectJson(approve, 400)).toEqual(invalid);
			const claim = await raw(app, "POST", claimPath, ctx.linguist, type, {});
			expect(await expectJson(claim, 400)).toEqual(invalid);
		}
		expect(stateOf(ctx.database, tasks.es)).toBe("submitted");
		expect(stateOf(ctx.database, open)).toBe("open");

		const cookieApprove = await send(app, "POST", approvePath, {
			cookie: ctx.firm.cookie,
			body: {},
		});
		expect(await expectJson(cookieApprove, 200)).toMatchObject({
			state: "approved",
		});
		const claimed = await send(app, "POST", claimPath, {
			cookie: ctx.linguist,
			body: {},
		});
		expect(await expectJson(claimed, 200)).toMatchObject({ state: "claimed" });
		const bearerApprove = await send(
			app,
			"POST",
			`/api/tasks/${tasks.fr}/approve`,
			{
				bearer: ctx.firm.mcpToken,
			},
		);
		expect(await expectJson(bearerApprove, 200)).toMatchObject({
			state: "approved",
		});
	});
});
