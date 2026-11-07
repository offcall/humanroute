// Slice migrations and the v1 refusal (ADR 0019, 0022).
import SqliteDriver from "better-sqlite3";
import { describe, expect, test } from "vitest";
import { assertNotLegacy } from "./legacy.js";
import { migrateSlices, type SliceDefinition } from "./slices.js";
import type { Database } from "./types.js";

const NOW = 1_700_000_000_000;
const now = () => NOW;

const tables = (database: Database): unknown[] =>
	database
		.prepare(
			"SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
		)
		.pluck()
		.all();

const recorded = (database: Database): unknown[] =>
	database
		.prepare("SELECT version, applied_at FROM schema_migrations ORDER BY rowid")
		.all();

describe("migrateSlices", () => {
	test("applies each slice's migrations once and records slice:version", () => {
		const database = new SqliteDriver(":memory:");
		const slices: SliceDefinition[] = [
			{
				slice: "alpha",
				migrations: [
					{ version: "0001", sql: ["CREATE TABLE a (id TEXT)"] },
					{ version: "0002", sql: ["ALTER TABLE a ADD COLUMN name TEXT"] },
				],
			},
			{
				slice: "beta",
				migrations: [{ version: "0001", sql: ["CREATE TABLE b (id TEXT)"] }],
			},
		];

		expect(migrateSlices(database, now, slices)).toEqual([
			"alpha:0001",
			"alpha:0002",
			"beta:0001",
		]);
		expect(recorded(database)).toEqual([
			{ version: "alpha:0001", applied_at: NOW },
			{ version: "alpha:0002", applied_at: NOW },
			{ version: "beta:0001", applied_at: NOW },
		]);
		database.prepare("INSERT INTO a (id, name) VALUES ('x', 'y')").run();

		expect(migrateSlices(database, now, slices)).toEqual([]);
		expect(recorded(database)).toHaveLength(3);
	});

	test("a failing migration rolls back only itself", () => {
		const database = new SqliteDriver(":memory:");
		const broken = {
			version: "0002",
			sql: ["CREATE TABLE half (id TEXT)", "CREATE TABLE oops ("],
		};
		const slices: SliceDefinition[] = [
			{
				slice: "alpha",
				migrations: [
					{ version: "0001", sql: ["CREATE TABLE a (id TEXT)"] },
					broken,
				],
			},
		];

		expect(() => migrateSlices(database, now, slices)).toThrow();
		expect(tables(database)).toEqual(["a", "schema_migrations"]);
		expect(recorded(database)).toEqual([
			{ version: "alpha:0001", applied_at: NOW },
		]);

		broken.sql = ["CREATE TABLE half (id TEXT)"];
		expect(migrateSlices(database, now, slices)).toEqual(["alpha:0002"]);
		expect(tables(database)).toEqual(["a", "half", "schema_migrations"]);
	});
});

describe("assertNotLegacy", () => {
	test("refuses a v1 database", () => {
		const noLedger = new SqliteDriver(":memory:");
		noLedger.exec("CREATE TABLE jobs (id TEXT)");
		expect(() => assertNotLegacy(noLedger)).toThrow(/legacy v1 database/);

		const v1Ledger = new SqliteDriver(":memory:");
		v1Ledger.exec(
			"CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
		);
		v1Ledger.exec("INSERT INTO schema_migrations VALUES ('0001', 1)");
		expect(() => assertNotLegacy(v1Ledger)).toThrow(/legacy v1 database/);

		const fresh = new SqliteDriver(":memory:");
		expect(() => assertNotLegacy(fresh)).not.toThrow();
		migrateSlices(fresh, now, [
			{
				slice: "alpha",
				migrations: [{ version: "0001", sql: ["CREATE TABLE a (id TEXT)"] }],
			},
		]);
		expect(() => assertNotLegacy(fresh)).not.toThrow();
	});
});
