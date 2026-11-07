import { describe, expect, test } from "vitest";
import {
	draftStatus,
	fakeWaitClock,
	nth,
	orderTask,
	paidWith,
	unpaid,
} from "./fakes.js";
import { fingerprint } from "./status.js";
import {
	DraftState,
	type Parsed,
	PublicState,
	type Snapshot,
	type WaitDeps,
	WaitKind,
} from "./types.js";
import { CAP_MS, waitForChange } from "./wait.js";

const { Open, Claimed, Submitted, PayingOut, Refunding, PaidOut, Refunded } =
	PublicState;

type Step = Parsed<Snapshot> | Snapshot;

const resultOf = (step: Step): Parsed<Snapshot> =>
	"ok" in step ? step : { ok: true, value: step };

// Reads the steps in order and repeats the last; each read takes readMs on the clock.
const runWait = async (
	steps: Step[],
	seen: string | undefined,
	options: { readMs?: number; controller?: AbortController } = {},
) => {
	const clock = fakeWaitClock();
	const controller = options.controller ?? new AbortController();
	const reports: [number, string][] = [];
	let reads = 0;
	const read = async () => {
		const step = nth(steps, Math.min(reads, steps.length - 1));
		reads += 1;
		clock.advance(options.readMs ?? 0);
		return resultOf(step);
	};
	const outcome = await waitForChange({
		read,
		seen,
		signal: controller.signal,
		report: async (message) => {
			reports.push([clock.deps.now(), message]);
		},
		deps: clock.deps,
	});
	return {
		outcome,
		reports,
		sleeps: clock.sleeps,
		reads: () => reads,
		now: clock.deps.now(),
	};
};

const failed = (error: string, permanent?: true): Parsed<Snapshot> =>
	permanent ? { ok: false, error, permanent } : { ok: false, error };

describe("waitForChange", () => {
	test("returns at once when every language is settled", async () => {
		const settled = paidWith(
			orderTask("de", PaidOut),
			orderTask("fr", Refunded),
		);

		const run = await runWait([settled], "paid;de=paid_out;fr=refunded");

		expect(run.outcome).toMatchObject({
			kind: WaitKind.Settled,
			seen: fingerprint(settled),
		});
		expect(run.sleeps).toEqual([]);
		expect(run.reports).toEqual([]);
	});

	test("returns on the first change from the given seen with a changes line and the new seen", async () => {
		const before = paidWith(orderTask("de", Open), orderTask("fr", Open));
		const after = paidWith(orderTask("de", Claimed), orderTask("fr", Open));

		const run = await runWait([before, before, after], fingerprint(before));

		expect(run.outcome).toMatchObject({
			kind: WaitKind.Changed,
			seen: "paid;de=claimed;fr=open",
		});
		expect(
			run.outcome.kind === WaitKind.Changed && run.outcome.text.split("\n")[0],
		).toBe("changes: de: open -> claimed");
		expect(run.reads()).toBe(3);
	});

	test("uses the first read as the baseline when no seen is given", async () => {
		const paid = paidWith(orderTask("de", Open));

		const run = await runWait([unpaid(), paid], undefined);

		expect(run.outcome).toMatchObject({
			kind: WaitKind.Changed,
			seen: "paid;de=open",
		});
		expect(run.outcome.kind === WaitKind.Changed && run.outcome.text).toContain(
			"changes: order: draft -> paid; de: awaiting payment -> open",
		);
	});

	test("returns at once on an orphaned draft and waits through settling", async () => {
		const settling: Snapshot = {
			status: draftStatus({ state: DraftState.Settling }),
			order: undefined,
		};
		const orphaned: Snapshot = {
			status: draftStatus({ state: DraftState.Orphaned, payTx: "pay-tx-1" }),
			order: undefined,
		};

		const direct = await runWait([orphaned], undefined);
		expect(direct.outcome).toMatchObject({
			kind: WaitKind.Orphaned,
			seen: "orphaned",
		});
		expect(direct.sleeps).toEqual([]);

		const run = await runWait([settling, settling, orphaned], "draft");
		expect(run.reads()).toBe(3);
		expect(run.reports.map(([, line]) => line)).toEqual([
			"payment settling: do not pay again",
		]);
		expect(
			run.outcome.kind === WaitKind.Orphaned && run.outcome.text,
		).toContain("changes: order: settling -> orphaned");
	});

	test("does not wake for a change only to paying_out or refunding", async () => {
		const submitted = paidWith(
			orderTask("de", Submitted),
			orderTask("fr", Submitted),
		);
		const transient = paidWith(
			orderTask("de", PayingOut),
			orderTask("fr", Refunding),
		);
		const final = paidWith(orderTask("de", PaidOut), orderTask("fr", Refunded));

		const run = await runWait(
			[submitted, transient, transient, final],
			fingerprint(submitted),
		);

		expect(run.reads()).toBe(4);
		expect(run.outcome).toMatchObject({
			kind: WaitKind.Settled,
			seen: "paid;de=paid_out;fr=refunded",
		});
		expect(
			run.outcome.kind === WaitKind.Settled && run.outcome.text.split("\n")[0],
		).toBe("changes: de: paying_out -> paid_out; fr: refunding -> refunded");

		const half = paidWith(orderTask("de", PaidOut), orderTask("fr", Submitted));
		const one = await runWait(
			[
				submitted,
				paidWith(orderTask("de", PayingOut), orderTask("fr", Submitted)),
				half,
			],
			fingerprint(submitted),
		);
		expect(one.outcome).toMatchObject({
			kind: WaitKind.Changed,
			seen: "paid;de=paid_out;fr=submitted",
		});
	});

	test("sends a progress line at once and then every 30 s, with the pay link while unpaid", async () => {
		const controller = new AbortController();
		const clock = fakeWaitClock();
		const reports: [number, string][] = [];
		const deps: WaitDeps = {
			now: clock.deps.now,
			sleep: async (millis, signal) => {
				await clock.deps.sleep(millis, signal);
				if (clock.deps.now() > 61_000) {
					controller.abort();
				}
			},
		};

		const outcome = await waitForChange({
			read: async () => ({ ok: true, value: unpaid() }),
			seen: "draft",
			signal: controller.signal,
			report: async (message) => {
				reports.push([deps.now(), message]);
			},
			deps,
		});

		expect(outcome).toEqual({ kind: WaitKind.Aborted });
		const line = "awaiting payment: https://gateway.test/pay/drf_1";
		expect(reports).toEqual([
			[0, line],
			[30_000, line],
			[60_000, line],
		]);
	});

	test("returns nothing changed after 60 minutes", async () => {
		const run = await runWait([unpaid()], "draft");

		expect(run.outcome).toMatchObject({ kind: WaitKind.Cap, seen: "draft" });
		expect(
			run.outcome.kind === WaitKind.Cap && run.outcome.text.split("\n")[0],
		).toBe("changes: none");
		expect(run.now).toBe(CAP_MS);

		const submitted = paidWith(orderTask("de", Submitted));
		const moved = await runWait(
			[submitted, paidWith(orderTask("de", PayingOut))],
			fingerprint(submitted),
		);
		expect(moved.outcome).toMatchObject({
			kind: WaitKind.Cap,
			seen: "paid;de=paying_out",
		});
	});

	test("keeps polling through failed reads and returns an error with the last seen after 30 s of consecutive failures", async () => {
		const down = failed("gateway is unreachable");
		// Reads take 1 s and sleeps 2 s: reads start at 0, 3000, ... 30000.
		const run = await runWait(Array(11).fill(down), "draft", { readMs: 1000 });

		expect(run.outcome).toEqual({
			kind: WaitKind.Error,
			message: "gateway is unreachable",
			seen: "draft",
			permanent: false,
		});
		expect(run.reads()).toBe(11);
		expect(run.now).toBe(31_000);
		expect(run.reports[0]).toEqual([1000, "gateway not answering, retrying"]);

		// A success at the 10th read resets the budget: failures restart at 33000 and end past 63000.
		const steps: Step[] = [
			...Array(10).fill(down),
			unpaid(),
			...Array(11).fill(down),
		];
		const reset = await runWait(steps, undefined, { readMs: 1000 });
		expect(reset.outcome).toMatchObject({
			kind: WaitKind.Error,
			seen: "draft",
		});
		expect(reset.now).toBe(64_000);
	});

	test("a permanent read failure ends the wait at once", async () => {
		const run = await runWait(
			[failed("gateway returned HTTP 404: not_found", true)],
			undefined,
		);

		expect(run.outcome).toEqual({
			kind: WaitKind.Error,
			message: "gateway returned HTTP 404: not_found",
			seen: undefined,
			permanent: true,
		});
		expect(run.reads()).toBe(1);
		expect(run.sleeps).toEqual([]);
	});

	test("stops when the call is aborted", async () => {
		const controller = new AbortController();
		const clock = fakeWaitClock();
		let reads = 0;
		const outcome = await waitForChange({
			read: async () => {
				reads += 1;
				// Aborted while the read is in flight: the read still resolves first.
				controller.abort();
				return { ok: true, value: unpaid() };
			},
			seen: "draft",
			signal: controller.signal,
			report: async () => undefined,
			deps: clock.deps,
		});

		expect(outcome).toEqual({ kind: WaitKind.Aborted });
		expect(reads).toBe(1);
		expect(clock.deps.now()).toBe(0);
	});
});
