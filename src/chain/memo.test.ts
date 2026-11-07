// The paged memo search of ADR 0039. The worker and requeue halves are in
// src/payouts/recover.test.ts and src/payouts/requeue.test.ts.
import {
	type ConfirmedSignatureInfo,
	Connection,
	Keypair,
} from "@solana/web3.js";
import { describe, expect, test, vi } from "vitest";
import { findMemo } from "./memo.js";
import { ErrorKind } from "./types.js";

const hold = Keypair.fromSeed(new Uint8Array(32).fill(1)).publicKey;
const MEMO = "hr:00000000-0000-4000-8000-000000000001";
// Transfer created_at, ms; coverage needs a block time below since/1000 - 600.
const SINCE = 1_800_000_000_000;
const NEWER = SINCE / 1000 + 60;
const OLDER = SINCE / 1000 - 601;

type Entry = Partial<ConfirmedSignatureInfo>;

const info = (index: number, entry: Entry = {}): ConfirmedSignatureInfo => ({
	signature: `sig-${index}`,
	slot: 1_000_000 - index,
	err: null,
	memo: null,
	blockTime: NEWER,
	...entry,
});

const unrelated = (count: number, from = 0): ConfirmedSignatureInfo[] =>
	Array.from({ length: count }, (_, offset) => info(from + offset));

// Pages the newest-first history as the RPC does: up to `limit` entries after `before`.
const history = (entries: ConfirmedSignatureInfo[]) => {
	const conn = new Connection("http://rpc.invalid");
	const pages = vi
		.spyOn(conn, "getSignaturesForAddress")
		.mockImplementation(async (_address, options) => {
			const before = options?.before;
			const start =
				before === undefined
					? 0
					: entries.findIndex((entry) => entry.signature === before) + 1;
			return entries.slice(start, start + (options?.limit ?? 1000));
		});
	return { conn, pages };
};

const search = (entries: ConfirmedSignatureInfo[]) => {
	const { conn, pages } = history(entries);
	return { pages, result: findMemo(conn, hold, MEMO, SINCE) };
};

const covered = (index: number) => info(index, { blockTime: OLDER });

describe("memo lookup distinguishes a successful exact memo from misleading or incomplete history", () => {
	test("ignores a failed transaction carrying the memo and a null memo", async () => {
		const failed = info(1, { memo: MEMO, err: { InstructionError: [0, "x"] } });
		const { result } = search([info(0), failed, covered(2)]);

		expect(await result).toEqual({ ok: true, value: { state: "absent" } });
	});

	test("finds the memo in the RPC format [len] memo", async () => {
		const hit = info(1, { memo: `[${MEMO.length}] ${MEMO}` });
		const { result, pages } = search([info(0), hit, covered(2)]);

		expect(await result).toEqual({
			ok: true,
			value: { state: "found", signature: "sig-1" },
		});
		expect(pages).toHaveBeenCalledWith(hold, { limit: 1000 }, "confirmed");
	});

	test("finds a successful memo on the second page behind 1,000 newer signatures", async () => {
		const entries = [
			...unrelated(1000),
			info(1000, { memo: MEMO }),
			covered(1001),
		];
		const { result, pages } = search(entries);

		expect(await result).toEqual({
			ok: true,
			value: { state: "found", signature: "sig-1000" },
		});
		expect(pages).toHaveBeenCalledTimes(2);
		expect(pages).toHaveBeenLastCalledWith(
			hold,
			{ limit: 1000, before: "sig-999" },
			"confirmed",
		);
	});

	test("is absent only once a block time is older than since minus 10 minutes", async () => {
		const edge = info(1, { blockTime: SINCE / 1000 - 600 });
		expect(await search([info(0), edge]).result).toEqual({
			ok: true,
			value: { state: "uncovered" },
		});
		expect(await search([info(0), covered(1)]).result).toEqual({
			ok: true,
			value: { state: "absent" },
		});
	});

	test.each([
		["10 full pages newer than since", unrelated(10_001)],
		["a short page before coverage", unrelated(1500)],
		[
			"only null block times",
			[info(0, { blockTime: null }), info(1, { blockTime: null })],
		],
		[
			"no block time at all",
			[{ signature: "sig-0", slot: 1, err: null, memo: null }],
		],
		["an empty history", []],
	])("is uncovered for %s", async (_name, entries) => {
		const { result, pages } = search(entries);

		expect(await result).toEqual({ ok: true, value: { state: "uncovered" } });
		expect(pages.mock.calls.length).toBeLessThanOrEqual(10);
	});

	test("stops after 10 pages", async () => {
		const { result, pages } = search(unrelated(12_000));

		expect(await result).toEqual({ ok: true, value: { state: "uncovered" } });
		expect(pages).toHaveBeenCalledTimes(10);
	});

	test("reports an RPC error on any page as an error, not a decision", async () => {
		const { conn, pages } = history(unrelated(2000));
		pages.mockResolvedValueOnce(unrelated(1000));
		pages.mockRejectedValueOnce(new Error("503 Service Unavailable"));

		expect(await findMemo(conn, hold, MEMO, SINCE)).toEqual({
			ok: false,
			error: { kind: ErrorKind.Retryable, message: "503 Service Unavailable" },
		});
	});
});
