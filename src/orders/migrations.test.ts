// Orders migration 0003 rebuilds orphans for the settle_unknown reason (ADR 0043).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { openStore } from "../store/index.js";
import { ordersSlice } from "./migrations.js";

const temp = mkdtempSync(join(tmpdir(), "hr-orders-"));

afterAll(() => {
	rmSync(temp, { recursive: true, force: true });
});

const INSERT =
	"INSERT INTO orphans (pay_tx, raw_header, reason, created_at, draft_id) VALUES (?, 'h', ?, 1, 'draft-1')";

describe("orders migrations", () => {
	test("migration 0003 keeps existing orphans and accepts settle_unknown", () => {
		const path = join(temp, "orders.sqlite");
		const earlier = {
			slice: ordersSlice.slice,
			migrations: ordersSlice.migrations.slice(0, 2),
		};
		const before = openStore(path, () => 0, [earlier]).database;
		before.prepare(INSERT).run("tx-a", "record_failed");
		expect(() => before.prepare(INSERT).run("tx-b", "settle_unknown")).toThrow(
			/CHECK/,
		);
		before.close();

		const { database, migrated } = openStore(path, () => 0, [ordersSlice]);
		expect(migrated).toEqual(["orders:0003"]);
		database.prepare(INSERT).run("tx-b", "settle_unknown");
		const orphans = database
			.prepare("SELECT pay_tx, reason, draft_id FROM orphans ORDER BY id")
			.all();
		expect(orphans).toEqual([
			{ pay_tx: "tx-a", reason: "record_failed", draft_id: "draft-1" },
			{ pay_tx: "tx-b", reason: "settle_unknown", draft_id: "draft-1" },
		]);
		database.close();
	});
});
