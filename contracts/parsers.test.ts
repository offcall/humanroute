// Real gateway responses (createTestGateway) through the MCP and web parsers: every parsed value
// equals the gateway's field, bigint amounts equal their decimal strings, extra fields are ignored.
import { describe, expect, test } from "vitest";
import {
	parseDraft,
	parseDraftStatus,
	parseOrder,
	parseTask,
} from "../mcp/parse.js";
import {
	createDraft,
	createTestGateway,
	expectJson,
	type Json,
	joinLinguist,
	listField,
	payDraft,
	paymentFor,
	registerAgency,
	registerFirm,
	type SendOptions,
	send,
	textField,
	WALLETS,
} from "../src/testing/index.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

// Paths where the parsed value differs from the gateway's; a parsed null or undefined matches
// a missing or null field.
const mismatches = (parsed: unknown, raw: unknown, path = "$"): string[] => {
	if (typeof parsed === "bigint") {
		return raw === parsed.toString()
			? []
			: [`${path}: ${parsed}n vs ${String(raw)}`];
	}
	if (parsed === null || parsed === undefined) {
		return raw === null || raw === undefined
			? []
			: [`${path}: empty vs ${JSON.stringify(raw)}`];
	}
	if (Array.isArray(parsed)) {
		if (!Array.isArray(raw) || raw.length !== parsed.length) {
			return [`${path}: list length differs`];
		}
		return parsed.flatMap((item, index) =>
			mismatches(item, raw[index], `${path}[${index}]`),
		);
	}
	if (isRecord(parsed)) {
		if (!isRecord(raw)) {
			return [`${path}: object vs ${JSON.stringify(raw)}`];
		}
		return Object.entries(parsed).flatMap(([key, value]) =>
			mismatches(value, raw[key], `${path}.${key}`),
		);
	}
	return Object.is(parsed, raw)
		? []
		: [`${path}: ${JSON.stringify(parsed)} vs ${JSON.stringify(raw)}`];
};

const parsedValue = (
	parsed: { ok: true; value: unknown } | { ok: false; error: string },
): unknown => {
	if (!parsed.ok) {
		throw new Error(parsed.error);
	}
	return parsed.value;
};

// web/ uses extensionless Bundler imports that the root tsc cannot check; Vitest resolves them,
// so web parsers load at runtime through a non-literal specifier.
const webParser = async (
	file: string,
	name: string,
): Promise<(raw: unknown) => unknown> => {
	const mod: unknown = await import(/* @vite-ignore */ `../web/src/${file}`);
	const parse = isRecord(mod) ? mod[name] : undefined;
	if (typeof parse !== "function") {
		throw new Error(`web/src/${file} has no ${name}`);
	}
	return (raw) => {
		const parsed: unknown = parse(raw);
		if (parsed === undefined) {
			throw new Error(`web ${name} refused ${JSON.stringify(raw)}`);
		}
		return parsed;
	};
};

const field = (value: unknown, key: string): unknown =>
	isRecord(value) ? value[key] : undefined;

// One order (es, fr) by a firm, an agency and a linguist of both pairs.
const scene = async () => {
	const gateway = createTestGateway();
	const { app } = gateway;
	const firm = await registerFirm(app, WALLETS.firm);
	const agency = await registerAgency(app, WALLETS.agency);
	const linguist = await joinLinguist(
		app,
		WALLETS.linguist,
		agency.inviteCode,
		[
			{ source: "en", target: "es" },
			{ source: "en", target: "fr" },
		],
	);
	const read = async (path: string, auth: SendOptions): Promise<Json> =>
		expectJson(await send(app, "GET", path, auth), 200);
	const post = async (path: string, auth: SendOptions): Promise<Json> =>
		expectJson(await send(app, "POST", path, auth), 200);

	return { ...gateway, firm, agency, linguist, read, post };
};

describe("cross-process parsers", () => {
	test("real gateway responses parse in the MCP parsers with equal values", async () => {
		const { app, firm, linguist, read, post, worker } = await scene();
		const bearer = { bearer: firm.mcpToken };
		const draft = await createDraft(app, firm.mcpToken);
		const draftId = textField(draft, "draftId");
		const checks: [string, unknown, unknown][] = [
			["draft", parsedValue(parseDraft(draft)), draft],
		];
		const status = async (stage: string) => {
			const raw = await read(`/api/orders/draft/${draftId}`, {});
			checks.push([`status ${stage}`, parsedValue(parseDraftStatus(raw)), raw]);
			return raw;
		};
		expect((await status("unpaid")).state).toBe("draft");

		const header = await paymentFor(app, draftId, WALLETS.firm, "contracts");
		const orderId = textField(
			await expectJson(await payDraft(app, draftId, header), 201),
			"orderId",
		);
		expect((await status("paid")).orderId).toBe(orderId);
		const order = async (stage: string) => {
			const raw = await read(`/api/orders/${orderId}`, bearer);
			checks.push([`order ${stage}`, parsedValue(parseOrder(raw)), raw]);
			for (const task of listField(raw, "tasks")) {
				const own = await read(
					`/api/tasks/${textField(task, "taskId")}`,
					bearer,
				);
				checks.push([`task ${stage}`, parsedValue(parseTask(own)), own]);
			}
			return listField(raw, "tasks").map((task) => textField(task, "taskId"));
		};

		const [es = "", fr = ""] = await order("open");
		const asLinguist = { cookie: linguist, body: {} };
		await post(`/api/tasks/${es}/claim`, asLinguist);
		await order("claimed");
		for (const taskId of [es, fr]) {
			if (taskId === fr) {
				await post(`/api/tasks/${fr}/claim`, asLinguist);
			}
			await post(`/api/tasks/${taskId}/submit`, {
				cookie: linguist,
				body: { result: "Hola" },
			});
		}
		await order("submitted");
		const approved = await post(`/api/tasks/${es}/approve`, bearer);
		checks.push(["approve", parsedValue(parseTask(approved)), approved]);
		const rejected = await post(`/api/tasks/${fr}/reject`, {
			...bearer,
			body: { reason: "No" },
		});
		checks.push(["reject", parsedValue(parseTask(rejected)), rejected]);
		for (let tick = 0; tick < 4; tick += 1) {
			await worker.tick();
		}
		await order("terminal");

		const states = checks.flatMap(([, parsed]) => {
			const tasks = field(parsed, "tasks");
			return Array.isArray(tasks)
				? tasks.map((task) => field(task, "publicState"))
				: [];
		});
		expect(new Set(states)).toEqual(
			new Set(["open", "claimed", "submitted", "paid_out", "refunded"]),
		);
		expect(field(checks[0]?.[1], "totalUnits")).toBe("1000000");
		for (const [label, parsed, raw] of checks) {
			expect(mismatches(parsed, raw), label).toEqual([]);
		}

		const extra = { ...draft, futureField: { nested: true } };
		expect(parsedValue(parseDraft(extra))).toEqual(
			parsedValue(parseDraft(draft)),
		);
	});

	test("real gateway responses parse in the web parsers with equal values", async () => {
		const { app, chain, firm, agency, linguist, read, post, worker } =
			await scene();
		const asFirm = { cookie: firm.cookie };
		const asLinguist = { cookie: linguist };
		const parsers = {
			view: await webParser("linguist/parseTaskView.ts", "parseView"),
			detail: await webParser("shared/viewParsers.ts", "parseTaskDetail"),
			board: await webParser("shared/boardParsers.ts", "parseBoard"),
			orders: await webParser("shared/viewParsers.ts", "parseOrders"),
			order: await webParser("shared/viewParsers.ts", "parseOrderView"),
			cabinet: await webParser("linguist/parseCabinet.ts", "parseCabinet"),
			firm: await webParser("firm/parseFirmView.ts", "parseFirmView"),
			autopay: await webParser("firm/autopayParse.ts", "parseAutopay"),
			agencyRating: await webParser(
				"shared/ratingParsers.ts",
				"parseAgencyRating",
			),
			firmRating: await webParser("shared/ratingParsers.ts", "parseFirmRating"),
			join: await webParser("shared/viewParsers.ts", "parseJoinPreview"),
		};
		const checks: [string, unknown, unknown][] = [];
		const check = (label: string, parsed: unknown, raw: unknown) => {
			checks.push([label, parsed, raw]);
		};
		// Wrapped views: the inner object is the gateway body itself.
		const wrapped = (
			label: string,
			parsed: unknown,
			inner: string,
			raw: Json,
		) => {
			check(`${label} ${inner}`, field(parsed, inner), raw);
			check(`${label} serverTime`, field(parsed, "serverTime"), raw.serverTime);
		};

		const draftId = textField(await createDraft(app, firm.mcpToken), "draftId");
		const header = await paymentFor(
			app,
			draftId,
			WALLETS.firm,
			"web-contracts",
		);
		const orderId = textField(
			await expectJson(await payDraft(app, draftId, header), 201),
			"orderId",
		);
		const board = await read("/api/board", asLinguist);
		check("board", parsers.board(board), board);
		const taskIds = listField(board, "tasks").map((task) =>
			textField(task, "taskId"),
		);
		expect(taskIds).toHaveLength(2);

		const snapshot = async (stage: string) => {
			const orders = await read("/api/orders", asFirm);
			check(`orders ${stage}`, parsers.orders(orders), orders);
			const order = await read(`/api/orders/${orderId}`, asFirm);
			wrapped(`order ${stage}`, parsers.order(order), "order", order);
			const cabinet = await read("/api/linguist", asLinguist);
			check(`cabinet ${stage}`, parsers.cabinet(cabinet), cabinet);
			for (const taskId of taskIds) {
				const detail = await read(`/api/tasks/${taskId}`, asFirm);
				wrapped(`detail ${stage}`, parsers.detail(detail), "task", detail);
				if (stage !== "open") {
					const view = await read(`/api/tasks/${taskId}`, asLinguist);
					wrapped(`view ${stage}`, parsers.view(view), "task", view);
				}
			}
		};

		await snapshot("open");
		const [es = "", fr = ""] = taskIds;
		for (const taskId of taskIds) {
			await post(`/api/tasks/${taskId}/claim`, { cookie: linguist, body: {} });
		}
		await snapshot("claimed");
		for (const taskId of taskIds) {
			await post(`/api/tasks/${taskId}/submit`, {
				cookie: linguist,
				body: { result: "Hola" },
			});
		}
		await snapshot("submitted");
		await post(`/api/tasks/${es}/approve`, { cookie: firm.cookie, body: {} });
		await post(`/api/tasks/${fr}/reject`, {
			cookie: firm.cookie,
			body: { reason: "No" },
		});
		await snapshot("decided");
		for (let tick = 0; tick < 4; tick += 1) {
			await worker.tick();
		}
		await snapshot("terminal");

		const firmView = await read("/api/firm", asFirm);
		check("firm", parsers.firm(firmView), firmView);
		const agencyRating = await read(
			`/api/rating/agency/${agency.agencyId}`,
			{},
		);
		check("agency rating", parsers.agencyRating(agencyRating), agencyRating);
		const firmRating = await read(`/api/rating/firm/${firm.firmId}`, {});
		check("firm rating", parsers.firmRating(firmRating), firmRating);
		const join = await read(`/api/linguist/join/${agency.inviteCode}`, {});
		check("join", parsers.join(join), join);

		const absent = await read("/api/firm/autopay", asFirm);
		const parsedAbsent = parsers.autopay(absent);
		check(
			"autopay absent",
			{
				...(isRecord(parsedAbsent) ? parsedAbsent : {}),
				allowanceUnits: undefined,
			},
			absent,
		);
		expect(field(parsedAbsent, "allowanceUnits")).toBe(0n);
		chain.answer.tokenAccount = async (owner) => ({
			ok: true,
			value: {
				exists: true,
				address: `usdc-of-${owner}`,
				amount: 7_000_000n,
				delegate: WALLETS.hold.address,
				delegatedAmount: 2_500_000n,
			},
		});
		const held = await read("/api/firm/autopay", asFirm);
		check("autopay held", parsers.autopay(held), held);
		expect(field(parsers.autopay(held), "allowanceUnits")).toBe(2_500_000n);

		expect(field(parsers.firmRating(firmRating), "refundedUnits")).toBe(
			500_000n,
		);
		for (const [label, parsed, raw] of checks) {
			expect(parsed, label).not.toBeUndefined();
			expect(mismatches(parsed, raw), label).toEqual([]);
		}
	});
});
