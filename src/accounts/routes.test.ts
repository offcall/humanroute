// Firm, agency and linguist registration through the cabinet routes (ADR 0020, 0021, 0033).
import { describe, expect, it } from "vitest";
import {
	createTestGateway,
	expectJson,
	joinLinguist,
	objectField,
	registerAgency,
	registerFirm,
	send,
	signIn,
	testWallet,
	textField,
	WALLETS,
} from "../testing/index.js";

const pairs = (count: number) =>
	Array.from({ length: count }, (_, index) => ({
		source: "en",
		target: String.fromCharCode(97 + index).repeat(2),
	}));

describe("accounts routes", () => {
	it("AC-01 /api/me lists every role of the wallet; 401 without session", async () => {
		const { app } = createTestGateway();
		expect((await send(app, "GET", "/api/me")).status).toBe(401);

		const firm = await registerFirm(app, WALLETS.agency);
		const agency = await registerAgency(app, WALLETS.agency);
		const cookie = await joinLinguist(app, WALLETS.agency, agency.inviteCode, [
			{ source: "en", target: "es" },
		]);
		const me = await expectJson(
			await send(app, "GET", "/api/me", { cookie }),
			200,
		);
		expect(me).toEqual({
			wallet: WALLETS.agency.address,
			firm: { id: firm.firmId, name: "MedSafe-Rx" },
			agency: { id: agency.agencyId, name: "Nairobi Lingua" },
			linguist: { id: expect.any(String), agencyId: agency.agencyId },
		});

		const plain = await signIn(app, WALLETS.agent);
		const bare = await send(app, "GET", "/api/me", { cookie: plain });
		expect(await expectJson(bare, 200)).toEqual({
			wallet: WALLETS.agent.address,
		});
	});

	it("AC-02 one firm per wallet; the MCP URL and token come back and GET /api/firm shows the same token", async () => {
		const { app, config } = createTestGateway();
		const cookie = await signIn(app, WALLETS.firm);
		const created = await expectJson(
			await send(app, "POST", "/api/firm", { cookie, body: { name: "A" } }),
			201,
		);
		const mcp = objectField(created, "mcp");
		expect(mcp.url).toBe(config.mcpPublicUrl);
		expect(textField(mcp, "token").length).toBeGreaterThan(20);

		const shown = await expectJson(
			await send(app, "GET", "/api/firm", { cookie }),
			200,
		);
		expect(shown).toEqual(created);

		const again = await send(app, "POST", "/api/firm", {
			cookie,
			body: { name: "B" },
		});
		expect(await expectJson(again, 409)).toEqual({ error: "firm_exists" });
	});

	it("AC-03 one agency per wallet; the invite is created once and reused under PUBLIC_BASE_URL", async () => {
		const { app, config } = createTestGateway();
		const agency = await registerAgency(app, WALLETS.agency);
		const { cookie } = agency;
		const url = `${config.publicBaseUrl}/join/${agency.inviteCode}`;

		const second = await expectJson(
			await send(app, "POST", "/api/agency/invite", { cookie, body: {} }),
			200,
		);
		expect(second).toEqual({ code: agency.inviteCode, url });

		const shown = await expectJson(
			await send(app, "GET", "/api/agency", { cookie }),
			200,
		);
		expect(shown.inviteUrl).toBe(url);

		const again = await send(app, "POST", "/api/agency", {
			cookie,
			body: { name: "X" },
		});
		expect(await expectJson(again, 409)).toEqual({ error: "agency_exists" });
	});

	it("AC-04 the invite preview shows the agency name without a session; an unknown code answers 404", async () => {
		const { app } = createTestGateway();
		const agency = await registerAgency(app, WALLETS.agency);

		const preview = await send(
			app,
			"GET",
			`/api/linguist/join/${agency.inviteCode}`,
		);
		expect(await expectJson(preview, 200)).toEqual({
			agency: { id: agency.agencyId, name: "Nairobi Lingua" },
		});

		const unknown = await send(app, "GET", "/api/linguist/join/nope");
		expect(await expectJson(unknown, 404)).toEqual({ error: "not_found" });
	});

	it("AC-05 joining twice with the same invite is fine; joining another agency answers 409 already_in_agency", async () => {
		const { app } = createTestGateway();
		const first = await registerAgency(app, WALLETS.agency);
		const other = await registerAgency(app, testWallet(40));
		const cookie = await signIn(app, WALLETS.linguist);
		const join = (code: string) =>
			send(app, "POST", `/api/linguist/join/${code}`, { cookie, body: {} });

		const joined = await expectJson(await join(first.inviteCode), 200);
		const twice = await expectJson(await join(first.inviteCode), 200);
		expect(twice).toEqual(joined);

		const moved = await join(other.inviteCode);
		expect(await expectJson(moved, 409)).toEqual({
			error: "already_in_agency",
		});
	});
});

describe("AC-06T account body parsing", () => {
	const linguist = async () => {
		const gateway = createTestGateway();
		const agency = await registerAgency(gateway.app, WALLETS.agency);
		const cookie = await joinLinguist(
			gateway.app,
			WALLETS.linguist,
			agency.inviteCode,
			[{ source: "de", target: "fr" }],
		);
		const put = (body: unknown) =>
			send(gateway.app, "PUT", "/api/linguist/languages", { cookie, body });
		return { ...gateway, cookie, put };
	};

	it.each([
		["1 pair", pairs(1), 1],
		["10 pairs", pairs(10), 10],
	])("AC-06 accepts %s", async (_, list, count) => {
		const { put } = await linguist();
		const body = await expectJson(await put({ pairs: list }), 200);
		expect(body.pairs).toEqual(list);
		expect(list).toHaveLength(count);
	});

	it.each([
		["11 pairs", pairs(11)],
		["11 raw duplicates", Array.from({ length: 11 }, () => pairs(1)[0])],
		["no pairs", []],
		["uppercase", [{ source: "EN", target: "es" }]],
		["three letters", [{ source: "eng", target: "es" }]],
		["source = target", [{ source: "en", target: "en" }]],
		["not an object", ["en-es"]],
	])("AC-06 refuses %s with 422", async (_, list) => {
		const { put } = await linguist();
		expect(await expectJson(await put({ pairs: list }), 422)).toEqual({
			error: "invalid_body",
		});
	});

	it("AC-06 drops valid duplicates and replaces the pairs as a whole", async () => {
		const { put } = await linguist();
		const es = { source: "en", target: "es" };
		const body = await expectJson(
			await put({ pairs: [es, es, { source: "en", target: "it" }] }),
			200,
		);
		expect(body.pairs).toEqual([es, { source: "en", target: "it" }]);
	});

	it("AC-06 non-JSON is 400 and a non-linguist is 403", async () => {
		const { app, cookie } = await linguist();
		const raw = await app.request("/api/linguist/languages", {
			method: "PUT",
			headers: { cookie, "content-type": "application/json" },
			body: "{not json",
		});
		expect(raw.status).toBe(400);

		const stranger = await signIn(app, WALLETS.firm);
		const body = { pairs: pairs(1) };
		const res = await send(app, "PUT", "/api/linguist/languages", {
			cookie: stranger,
			body,
		});
		expect(await expectJson(res, 403)).toEqual({ error: "forbidden" });
	});

	it.each([
		["/api/firm", "firm"],
		["/api/agency", "agency"],
	])("AC-07 %s names are trimmed and 1..100 chars", async (path, key) => {
		const { app } = createTestGateway();
		const register = async (wallet: number, name: unknown) =>
			send(app, "POST", path, {
				cookie: await signIn(app, testWallet(wallet)),
				body: { name },
			});

		for (const name of ["", "   ", "x".repeat(101), 7]) {
			expect((await register(50, name)).status).toBe(422);
		}
		const padded = await expectJson(
			await register(51, `  ${"x".repeat(100)}  `),
			201,
		);
		expect(objectField(padded, key).name).toBe("x".repeat(100));
		const short = await expectJson(await register(52, " A "), 201);
		expect(objectField(short, key).name).toBe("A");
	});
});
