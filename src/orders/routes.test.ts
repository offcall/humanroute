// Draft intake and order reads (api.md, failure table rows 1-2, ADR 0022).
import { describe, expect, it } from "vitest";
import {
	createDraft,
	createTestGateway,
	expectJson,
	LEAFLET,
	listField,
	payDraft,
	paymentFor,
	registerFirm,
	send,
	signIn,
	type TestGateway,
	textField,
	WALLETS,
} from "../testing/index.js";

const target = (targetLang: string, draft = "x") => ({ targetLang, draft });
const LANGS = ["es", "fr", "de", "it", "pt", "nl"];
const withTargets = (count: number) => ({
	...LEAFLET,
	targets: LANGS.slice(0, count).map((lang) => target(lang)),
});

const postDraft = (gateway: TestGateway, token: string, body: unknown) =>
	send(gateway.app, "POST", "/api/orders/draft", { bearer: token, body });

describe("draft intake", () => {
	it("OR-01 creates a draft priced task count × TASK_PRICE_USDC with a pay link under PUBLIC_BASE_URL", async () => {
		const gateway = createTestGateway();
		const firm = await registerFirm(gateway.app, WALLETS.firm);
		const draft = await createDraft(gateway.app, firm.mcpToken, withTargets(3));
		const draftId = textField(draft, "draftId");

		expect(draft).toEqual(
			expect.objectContaining({
				payUrl: `http://humanroute.test/pay/${draftId}`,
				priceUnits: "500000",
				totalUnits: "1500000",
				taskCount: 3,
			}),
		);
	});

	it("OR-02 refuses a draft without a Bearer token, with an unknown token, and with a firm session cookie instead of the MCP token (401)", async () => {
		const gateway = createTestGateway();
		const firm = await registerFirm(gateway.app, WALLETS.firm);
		const path = "/api/orders/draft";
		const attempts = [
			send(gateway.app, "POST", path, { body: LEAFLET }),
			send(gateway.app, "POST", path, { body: LEAFLET, bearer: "nope" }),
			send(gateway.app, "POST", path, { body: LEAFLET, cookie: firm.cookie }),
		];
		for (const res of await Promise.all(attempts)) {
			expect(await expectJson(res, 401)).toEqual({ error: "unauthorized" });
		}
		expect(gateway.database.prepare("SELECT * FROM drafts").all()).toEqual([]);
	});
});

describe("OR-03T draft body and draft read refusals", () => {
	const refused: [string, unknown][] = [
		["blank text", { ...LEAFLET, text: "" }],
		["whitespace-only text", { ...LEAFLET, text: " \n\t " }],
		["5001-char text", { ...LEAFLET, text: "a".repeat(5001) }],
		[
			"5001-char target draft",
			{ ...LEAFLET, targets: [target("es", "a".repeat(5001))] },
		],
		["one-letter code", { ...LEAFLET, sourceLang: "e" }],
		["uppercase code", { ...LEAFLET, targets: [target("ES")] }],
		["three-letter code", { ...LEAFLET, sourceLang: "eng" }],
		["target = source", { ...LEAFLET, targets: [target("en")] }],
		[
			"duplicate targets",
			{ ...LEAFLET, targets: [target("es"), target("es")] },
		],
		["0 targets", withTargets(0)],
		["6 targets", withTargets(6)],
		["array meta", { ...LEAFLET, meta: [1] }],
		["scalar meta", { ...LEAFLET, meta: "ref-7" }],
		["array body", [LEAFLET]],
		["string body", "hello"],
	];
	it.each(refused)(
		"OR-03 refuses %s with 422 invalid_body",
		async (_name, body) => {
			const gateway = createTestGateway();
			const firm = await registerFirm(gateway.app, WALLETS.firm);
			const res = await postDraft(gateway, firm.mcpToken, body);
			expect(await expectJson(res, 422)).toEqual({ error: "invalid_body" });
		},
	);

	const accepted: [string, unknown][] = [
		["5000-char text", { ...LEAFLET, text: "a".repeat(5000) }],
		["1 target", withTargets(1)],
		["5 targets", withTargets(5)],
		["null meta", { ...LEAFLET, meta: null }],
		["omitted meta", LEAFLET],
		["object meta", { ...LEAFLET, meta: { ref: "7" } }],
		["an empty target draft", { ...LEAFLET, targets: [target("es", "")] }],
	];
	it.each(accepted)("OR-03 accepts %s", async (_name, body) => {
		const gateway = createTestGateway();
		const firm = await registerFirm(gateway.app, WALLETS.firm);
		await expectJson(await postDraft(gateway, firm.mcpToken, body), 201);
	});

	it("OR-04 answers 400 invalid_json for malformed JSON", async () => {
		const gateway = createTestGateway();
		const firm = await registerFirm(gateway.app, WALLETS.firm);
		const res = await gateway.app.request("/api/orders/draft", {
			method: "POST",
			headers: {
				authorization: `Bearer ${firm.mcpToken}`,
				"content-type": "application/json",
			},
			body: "{not json",
		});
		expect(await expectJson(res, 400)).toEqual({ error: "invalid_json" });
	});

	const paidOrder = async (gateway: TestGateway) => {
		const firm = await registerFirm(gateway.app, WALLETS.firm);
		const draftId = textField(
			await createDraft(gateway.app, firm.mcpToken),
			"draftId",
		);
		const header = await paymentFor(gateway.app, draftId, WALLETS.firm, "a");
		const paid = await expectJson(
			await payDraft(gateway.app, draftId, header),
			201,
		);
		return { firm, draftId, orderId: textField(paid, "orderId") };
	};
	const readDraft = (gateway: TestGateway, draftId: string) =>
		send(gateway.app, "GET", `/api/orders/draft/${draftId}`);

	it("OR-05 the public draft read shows no autopay field and, once paid, the order id and each task's public state", async () => {
		const gateway = createTestGateway();
		const firm = await registerFirm(gateway.app, WALLETS.firm);
		const draftId = textField(
			await createDraft(gateway.app, firm.mcpToken),
			"draftId",
		);
		const unpaid = await expectJson(await readDraft(gateway, draftId), 200);
		expect(unpaid).not.toHaveProperty("autopay");
		expect(unpaid).not.toHaveProperty("orderId");
		expect(unpaid.state).toBe("draft");

		const header = await paymentFor(gateway.app, draftId, WALLETS.firm, "a");
		const paid = await expectJson(
			await payDraft(gateway.app, draftId, header),
			201,
		);
		const read = await expectJson(await readDraft(gateway, draftId), 200);
		expect(read).not.toHaveProperty("autopay");
		expect(read.state).toBe("paid");
		expect(read.orderId).toBe(paid.orderId);
		expect(listField(read, "tasks")).toEqual(
			["es", "fr"].map((targetLang) =>
				expect.objectContaining({ targetLang, publicState: "open" }),
			),
		);
		expect(listField(read, "tasks").map((task) => task.taskId)).toEqual(
			paid.taskIds,
		);
	});

	it("OR-06 hides an unknown draft and an unpaid draft at its TTL, never a paid one, without a chain read", async () => {
		const gateway = createTestGateway();
		const ttl = gateway.config.draftTtlSeconds * 1000;
		const { firm, draftId: paidId } = await paidOrder(gateway);
		const unpaidId = textField(
			await createDraft(gateway.app, firm.mcpToken),
			"draftId",
		);
		const chainCalls = gateway.chain.calls.length;
		expect((await readDraft(gateway, "no-such-draft")).status).toBe(404);

		const statuses: [number, number, number][] = [];
		let elapsed = 0;
		for (const at of [ttl - 1, ttl, ttl + 1]) {
			gateway.clock.advance(at - elapsed);
			elapsed = at;
			const unpaid = (await readDraft(gateway, unpaidId)).status;
			statuses.push([
				at - ttl,
				unpaid,
				(await readDraft(gateway, paidId)).status,
			]);
		}
		expect(statuses).toEqual([
			[-1, 200, 200],
			[0, 404, 200],
			[1, 404, 200],
		]);
		expect(gateway.chain.calls.length).toBe(chainCalls);
	});

	it("OR-07a GET /api/orders lists only the cookie firm's own orders", async () => {
		const gateway = createTestGateway();
		const { firm, orderId } = await paidOrder(gateway);
		const other = await registerFirm(gateway.app, WALLETS.agency);
		await createDraft(gateway.app, other.mcpToken);
		const list = (options: { cookie?: string; bearer?: string }) =>
			send(gateway.app, "GET", "/api/orders", options);

		const own = await expectJson(await list({ cookie: firm.cookie }), 200);
		expect(own.serverTime).toBe(new Date(gateway.clock.now()).toISOString());
		expect(listField(own, "orders").map((order) => order.orderId)).toEqual([
			orderId,
		]);
		const empty = await expectJson(await list({ cookie: other.cookie }), 200);
		expect(empty.orders).toEqual([]);
		expect((await list({ bearer: firm.mcpToken })).status).toBe(401);
		const linguist = await signIn(gateway.app, WALLETS.linguist);
		expect((await list({ cookie: linguist })).status).toBe(403);
	});

	it("OR-07b GET /api/orders/:id answers only the owning firm", async () => {
		const gateway = createTestGateway();
		const { firm, orderId } = await paidOrder(gateway);
		const other = await registerFirm(gateway.app, WALLETS.agency);
		const linguist = await signIn(gateway.app, WALLETS.linguist);
		const read = (id: string, options: { cookie?: string; bearer?: string }) =>
			send(gateway.app, "GET", `/api/orders/${id}`, options).then(
				(res) => res.status,
			);

		expect(await read("no-such-order", {})).toBe(404);
		expect(await read(orderId, {})).toBe(401);
		expect(await read(orderId, { cookie: other.cookie })).toBe(403);
		expect(await read(orderId, { bearer: other.mcpToken })).toBe(403);
		expect(await read(orderId, { cookie: linguist })).toBe(403);
		expect(await read(orderId, { cookie: firm.cookie })).toBe(200);
		expect(await read(orderId, { bearer: firm.mcpToken })).toBe(200);
	});
});
