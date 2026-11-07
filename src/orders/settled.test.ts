// The settled()/PAYMENT-RESPONSE seam: order or orphan (failure table row 8, ADR 0016, ADR 0022).
import { Hono } from "hono";
import { describe, expect, test } from "vitest";
import { openStore } from "../store/index.js";
import { tasksSlice } from "../tasks/index.js";
import {
	expectJson,
	LEAFLET,
	sequentialIds,
	testClock,
	testConfig,
	WALLETS,
} from "../testing/index.js";
import { insertDraft } from "./drafts.js";
import { ordersSlice } from "./migrations.js";
import { countUnresolvedOrphans } from "./orderRepo.js";
import { settled } from "./settled.js";
import type { CreatedTask, Draft, OrdersDeps, OrdersEnv } from "./types.js";

const config = testConfig();
const unused = () => {
	throw new Error("not used by settled()");
};

const seam = (onTasksCreated?: OrdersDeps["onTasksCreated"]) => {
	const clock = testClock();
	const { database } = openStore(":memory:", clock.now, [
		tasksSlice,
		ordersSlice,
	]);
	const logs: string[] = [];
	const deps: OrdersDeps = {
		database,
		facilitator: { getSupported: unused, verify: unused, settle: unused },
		network: config.network,
		usdcMint: config.usdcMint,
		payTo: WALLETS.hold.address,
		taskPriceUnits: config.taskPriceUnits,
		claimWindowSeconds: config.claimWindowSeconds,
		draftTtlSeconds: config.draftTtlSeconds,
		publicBaseUrl: config.publicBaseUrl,
		sessionCookie: "hr_session",
		lookupSession: () => null,
		firmByWallet: () => null,
		firmByMcpToken: () => null,
		firmById: (id) => ({ id, name: "MedSafe-Rx" }),
		agencyById: () => null,
		translatorNo: () => null,
		firmWallet: () => WALLETS.firm.address,
		tokenAccountOf: unused,
		solBalanceOf: unused,
		latestBlockhash: unused,
		transferOf: () => null,
		preflightProblems: () => [],
		now: clock.now,
		sleep: unused,
		newId: sequentialIds(),
		log: (msg) => {
			logs.push(msg);
		},
		...(onTasksCreated === undefined ? {} : { onTasksCreated }),
	};
	const draft = (): Draft =>
		insertDraft(deps, "firm-1", { ...LEAFLET, metaJson: null });
	const post = (header: string, target: Draft, payId: string | null = null) =>
		new Hono<OrdersEnv>()
			.post("/", (ctx) => settled(deps, ctx, header, target, payId))
			.request("/", { method: "POST" });
	const count = (table: string): unknown =>
		database.prepare(`SELECT COUNT(*) AS total FROM ${table}`).pluck().get();
	const orphans = () => database.prepare("SELECT * FROM orphans").all();
	const orderIdOf = (target: Draft): unknown =>
		database
			.prepare("SELECT order_id FROM drafts WHERE id = ?")
			.pluck()
			.get(target.id);
	return { deps, database, logs, draft, post, count, orphans, orderIdOf };
};

type Seam = ReturnType<typeof seam>;

const encoded = (value: unknown): string =>
	Buffer.from(JSON.stringify(value)).toString("base64");

const settleHeader = (overrides: Record<string, unknown> = {}): string =>
	encoded({
		success: true,
		transaction: "pay-tx-1",
		network: config.network,
		payer: WALLETS.firm.address,
		...overrides,
	});

// 502 orphan_payment with the settle header, one orphans row, nothing recorded, draft unpaid.
const expectOrphan = async (
	world: Seam,
	target: Draft,
	res: Response,
	header: string,
	reason: string,
	payTx: string | null,
) => {
	expect(res.headers.get("PAYMENT-RESPONSE")).toBe(header);
	expect(await expectJson(res, 502)).toEqual({
		error: "orphan_payment",
		payTx,
	});
	expect(world.orphans()).toEqual([
		expect.objectContaining({ pay_tx: payTx, reason, raw_header: header }),
	]);
	expect(world.count("tasks")).toBe(0);
	expect(world.count("payments")).toBe(0);
	expect(world.orderIdOf(target)).toBeNull();
};

describe("settled", () => {
	test("a settlement on another network becomes an orphan", async () => {
		const world = seam();
		const target = world.draft();
		const header = settleHeader({ network: "solana:mainnet" });

		const res = await world.post(header, target, "pay-id-1");
		await expectOrphan(world, target, res, header, "wrong_network", "pay-tx-1");
		expect(world.orphans()).toEqual([
			expect.objectContaining({ network: "solana:mainnet" }),
		]);
		expect(world.count("orders")).toBe(0);
	});

	test.each([
		["missing", { payer: undefined }],
		["malformed", { payer: "not-a-key!" }],
		["wrong-length", { payer: "1111" }],
	])(
		"a settlement with a %s payer becomes an orphan (invalid_payer)",
		async (_name, overrides) => {
			const world = seam();
			const target = world.draft();
			const header = settleHeader(overrides);

			const res = await world.post(header, target);
			await expectOrphan(
				world,
				target,
				res,
				header,
				"invalid_payer",
				"pay-tx-1",
			);
			expect(world.count("orders")).toBe(0);
		},
	);

	test.each([
		["malformed base64", "%%%", null],
		["malformed JSON", Buffer.from("{oops").toString("base64"), null],
		["a non-object", encoded([1, 2]), null],
		["no transaction", settleHeader({ transaction: undefined }), null],
		["no network", settleHeader({ network: undefined }), "pay-tx-1"],
		["success false", settleHeader({ success: false }), "pay-tx-1"],
	])(
		"an unreadable settlement (%s) becomes an orphan (unparsable_settle)",
		async (_name, header, payTx) => {
			const world = seam();
			const target = world.draft();

			const res = await world.post(header, target);
			await expectOrphan(
				world,
				target,
				res,
				header,
				"unparsable_settle",
				payTx,
			);
			expect(world.count("orders")).toBe(0);
		},
	);

	test.each([
		[
			"the pay_tx of an existing order",
			(world: Seam) =>
				world.database.exec(`INSERT INTO orders VALUES
  ('order-0', 'draft-0', 'firm-1', 'pay-tx-1', '${WALLETS.firm.address}', '1000000', 0)`),
		],
		[
			"a failing second task insert",
			(world: Seam) =>
				world.database.exec(`CREATE TRIGGER fail_fr BEFORE INSERT ON tasks
  WHEN NEW.target_lang = 'fr' BEGIN SELECT RAISE(ABORT, 'disk full'); END`),
		],
	])(
		"a settlement whose order cannot be recorded becomes an orphan (record_failed): %s",
		async (_name, arrange) => {
			const world = seam();
			arrange(world);
			const orders = world.count("orders");
			const target = world.draft();
			const header = settleHeader();

			const res = await world.post(header, target, "pay-id-1");
			await expectOrphan(
				world,
				target,
				res,
				header,
				"record_failed",
				"pay-tx-1",
			);
			expect(world.count("orders")).toBe(orders);
		},
	);

	test("logs best-effort payment identity before validation and recording", async () => {
		const world = seam();
		const target = world.draft();
		await world.post(settleHeader({ network: "solana:mainnet" }), target);
		await world.post(settleHeader({ payer: "not-a-key!" }), target);
		await world.post("%%%", target);

		const firstLines = world.logs.filter((line) => line.startsWith("settled "));
		expect(firstLines).toEqual([
			`settled transaction=pay-tx-1 payer=${WALLETS.firm.address}`,
			"settled transaction=pay-tx-1 payer=not-a-key!",
			"settled transaction=? payer=?",
		]);
		expect(world.logs[0]).toBe(firstLines[0]);
	});

	test("counts unresolved orphans", () => {
		const world = seam();
		const insert = world.database.prepare(
			"INSERT INTO orphans (pay_tx, raw_header, reason, created_at, resolved_at) VALUES (?, 'h', 'record_failed', 0, ?)",
		);
		expect(countUnresolvedOrphans(world.database)).toBe(0);
		insert.run("tx-a", null);
		insert.run("tx-b", 5);
		insert.run(null, null);
		expect(countUnresolvedOrphans(world.database)).toBe(2);
	});
});

// Runs the setImmediate callbacks queued so far and the promise chains they start.
const flushImmediate = () =>
	new Promise<void>((resolve) => setImmediate(resolve));

describe("new-task hook", () => {
	test("a paid order triggers the new-task hook after the 201 and a failing hook never changes the 201", async () => {
		const seen: CreatedTask[][] = [];
		const world = seam(async (tasks) => {
			seen.push(tasks);
			throw new Error("push service down");
		});
		const target = world.draft();

		const res = await world.post(settleHeader(), target, "pay-id-1");
		expect(seen).toEqual([]);
		expect(world.count("tasks")).toBe(2);
		const receipt = await expectJson(res, 201);
		await flushImmediate();
		await flushImmediate();

		const deadline = world.deps.now() + config.claimWindowSeconds * 1000;
		expect(seen).toEqual([
			["es", "fr"].map((targetLang) =>
				expect.objectContaining({
					source: "en",
					target: targetLang,
					claimDeadline: deadline,
				}),
			),
		]);
		expect(seen[0]?.map((task) => task.taskId)).toEqual(receipt.taskIds);
		expect(world.logs).toContain(
			`tasks created hook failed order ${String(receipt.orderId)}: push service down`,
		);
	});
});
