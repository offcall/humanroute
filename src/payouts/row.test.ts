import { describe, expect, test } from "vitest";
import { insertTasks, taskById } from "../tasks/index.js";
import { createTestGateway, WALLETS } from "../testing/index.js";
import { taskLedger } from "./ledger.js";
import { legsJson, parseLegs } from "./row.js";
import { LegRole, PayoutKind } from "./taskTypes.js";

const ABOVE_SAFE = BigInt(Number.MAX_SAFE_INTEGER) + 2n;
const U64_MAX = 2n ** 64n - 1n;

describe("large bigint amounts roundtrip SQLite and JSON without precision loss", () => {
	test("keeps payout leg units above 2^53 and at u64 max exact", () => {
		const { database, clock } = createTestGateway();
		const ledger = taskLedger(database);
		const legs = [
			{
				role: LegRole.Linguist,
				wallet: WALLETS.linguist.address,
				units: U64_MAX,
			},
			{
				role: LegRole.Agency,
				wallet: WALLETS.agency.address,
				units: ABOVE_SAFE,
			},
			{ role: LegRole.Fee, wallet: WALLETS.fee.address, units: U64_MAX - 1n },
		];
		ledger.insert(
			{
				id: "t1",
				taskId: "task-1",
				kind: PayoutKind.Payout,
				legs,
				memo: "hr:task-1",
			},
			clock.now(),
		);

		expect(ledger.find("t1")?.legs).toEqual(legs);
		expect(parseLegs(legsJson(legs))).toEqual(legs);
		expect(legsJson(legs)).toContain('"units":"18446744073709551615"');
	});

	test("keeps task prices above 2^53 exact", () => {
		const { database, clock } = createTestGateway();
		const task = {
			id: "task-1",
			orderId: "order-1",
			firmId: "firm-1",
			sourceLang: "en",
			targetLang: "es",
			text: "text",
			draft: "draft",
			priceUnits: U64_MAX,
			refundWallet: WALLETS.firm.address,
			claimDeadline: clock.now() + 60_000,
		};
		insertTasks(
			database,
			[task, { ...task, id: "task-2", priceUnits: ABOVE_SAFE }],
			clock.now(),
		);

		expect(taskById(database, "task-1")?.priceUnits).toBe(U64_MAX);
		expect(taskById(database, "task-2")?.priceUnits).toBe(ABOVE_SAFE);
	});

	test.each([
		["negative", '"-1"'],
		["fractional", '"1.5"'],
		["non-numeric", '"abc"'],
		["exponent", '"1e6"'],
		["empty", '""'],
		["a JSON number", "5"],
	])("refuses %s leg units", (_name, units) => {
		const json = `[{"role":"linguist","wallet":"w","units":${units}}]`;
		expect(() => parseLegs(json)).toThrow();
	});
});
