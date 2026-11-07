import { afterEach, describe, expect, test, vi } from "vitest";
import { offerFor, unsignedFor } from "./fakePayment.js";
import { jsonResponse, nth, stubFetch } from "./fakes.js";
import { createPayClient } from "./payGateway.js";
import { PayOutcome } from "./payTypes.js";

const BASE = "https://gateway.test";
const client = createPayClient(BASE);
const header = (value: unknown) =>
	Buffer.from(JSON.stringify(value), "utf8").toString("base64");
const paymentRequired = (extra: Record<string, unknown> = {}) =>
	header({
		x402Version: 2,
		resource: offerFor().resource,
		accepts: [{ ...offerFor().accepted, scheme: "upto" }, offerFor().accepted],
		...extra,
	});
const answer = (response: () => Response) => stubFetch(async () => response());
const unknownRule = "ask before calling prepare_payment or pay_task again";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("pay gateway client outcomes", () => {
	test("offer reads the exact requirement and resource from the 402", async () => {
		const calls = answer(() =>
			jsonResponse(402, {}, { "PAYMENT-REQUIRED": paymentRequired() }),
		);

		expect(await client.offer("drf/1")).toEqual({
			ok: true,
			value: offerFor(),
		});
		expect(nth(calls, 0).url).toBe(`${BASE}/x/orders/drf%2F1`);
		expect(nth(calls, 0).init?.method).toBe("POST");
	});

	test("offer refuses a non-402 answer", async () => {
		answer(() => jsonResponse(404, { error: "not_found" }));

		expect(await client.offer("drf_1")).toEqual({
			ok: false,
			error: "gateway refused the payment: not_found",
		});
	});

	test.each([
		["autopay_off", {}, "auto-pay is off for this firm"],
		[
			"autopay_limit",
			{ leftUnits: "500000" },
			"limit is too low (0.50 USDC left)",
		],
		[
			"insufficient_usdc",
			{ balanceUnits: "1250000" },
			"the firm wallet has only 1.25 USDC",
		],
		["no_usdc_account", {}, "has no USDC account yet"],
		["draft_paid", {}, "this draft is already paid: call get_task"],
		["not_found", {}, "do not wait again or create a new draft automatically"],
	])("unsigned maps %s to a user instruction", async (code, extra, text) => {
		const calls = answer(() => jsonResponse(409, { error: code, ...extra }));

		const unsigned = await client.unsigned("tok_1", "drf_1", "FEE");

		expect(unsigned).toEqual({
			ok: false,
			error: expect.stringContaining(text),
		});
		expect(nth(calls, 0).url).toBe(`${BASE}/api/orders/draft/drf_1/unsigned`);
		expect(new Headers(nth(calls, 0).init?.headers).get("authorization")).toBe(
			"Bearer tok_1",
		);
		expect(nth(calls, 0).init?.body).toBe(JSON.stringify({ feePayer: "FEE" }));
	});

	test("unsigned returns the gateway's unsigned payment", async () => {
		answer(() => jsonResponse(200, unsignedFor()));

		expect(await client.unsigned("tok_1", "drf_1", "FEE")).toEqual({
			ok: true,
			value: unsignedFor(),
		});
	});

	test("a 201 is the paid order", async () => {
		const calls = answer(() =>
			jsonResponse(201, { orderId: "ord_1", payTx: "tx1" }),
		);

		expect(await client.pay("drf_1", "HDR")).toEqual({
			ok: true,
			value: {
				outcome: PayOutcome.Paid,
				order: { orderId: "ord_1", payTx: "tx1" },
			},
		});
		expect(
			new Headers(nth(calls, 0).init?.headers).get("PAYMENT-SIGNATURE"),
		).toBe("HDR");
	});

	test("a 409 draft_paid is already paid, not an error", async () => {
		answer(() => jsonResponse(409, { error: "draft_paid" }));

		expect(await client.pay("drf_1", "HDR")).toEqual({
			ok: true,
			value: { outcome: PayOutcome.AlreadyPaid },
		});
	});

	test("a 409 payment_in_progress says still settling and forbids a new prepare_payment", async () => {
		answer(() => jsonResponse(409, { error: "payment_in_progress" }));

		const paid = await client.pay("drf_1", "HDR");

		expect(paid.ok).toBe(false);
		expect(paid.ok ? "" : paid.error).toContain(
			"call get_task in a few seconds",
		);
		expect(paid.ok ? "" : paid.error).toContain("do not call prepare_payment");
	});

	test("a 502 orphan_payment says the money was taken, with payTx, and forbids paying again", async () => {
		answer(() =>
			jsonResponse(502, { error: "orphan_payment", payTx: "txOrphan" }),
		);

		const paid = await client.pay("drf_1", "HDR");

		expect(paid.ok).toBe(false);
		const error = paid.ok ? "" : paid.error;
		expect(error).toContain("the money was taken (payTx txOrphan)");
		expect(error).toContain("Do NOT pay again");
		expect(error).not.toContain("prepare_payment again");
	});

	test.each([
		["HTTP 500", () => jsonResponse(500, { error: "internal_error" })],
		["HTTP 502", () => jsonResponse(502, { error: "bad_gateway" })],
		["HTTP 503", () => jsonResponse(503, {})],
		["invalid JSON", () => new Response("<html>oops</html>", { status: 502 })],
	])(
		"%s may have settled: get_task, ask before paying again",
		async (_name, response) => {
			answer(response);

			const paid = await client.pay("drf_1", "HDR");

			expect(paid).toEqual({
				ok: false,
				error: expect.stringContaining(
					"the payment may have settled. Call get_task",
				),
			});
			expect(paid.ok ? "" : paid.error).toContain(unknownRule);
		},
	);

	test.each([
		[
			"a connection error",
			new TypeError("fetch failed"),
			"gateway is unreachable",
		],
		[
			"a TimeoutError",
			new DOMException("timed out", "TimeoutError"),
			"gateway did not answer in time",
		],
	])(
		"%s may have settled: get_task, ask before paying again",
		async (_name, thrown, reason) => {
			const timeout = vi.spyOn(AbortSignal, "timeout");
			stubFetch(async () => {
				throw thrown;
			});

			const paid = await client.pay("drf_1", "HDR");

			expect(timeout).toHaveBeenCalledWith(45_000);
			expect(paid).toEqual({
				ok: false,
				error: expect.stringContaining(reason),
			});
			expect(paid.ok ? "" : paid.error).toContain(unknownRule);
		},
	);

	test("a 402 reason comes from PAYMENT-RESPONSE, else PAYMENT-REQUIRED", async () => {
		answer(() =>
			jsonResponse(
				402,
				{},
				{
					"PAYMENT-RESPONSE": header({ errorReason: "settle_failed" }),
					"PAYMENT-REQUIRED": paymentRequired({ error: "verify_failed" }),
				},
			),
		);
		expect(await client.pay("drf_1", "HDR")).toEqual({
			ok: false,
			error: "payment failed: settle_failed",
		});

		answer(() =>
			jsonResponse(
				402,
				{},
				{ "PAYMENT-REQUIRED": paymentRequired({ error: "verify_failed" }) },
			),
		);
		expect(await client.pay("drf_1", "HDR")).toEqual({
			ok: false,
			error: "payment failed: verify_failed",
		});

		answer(() => jsonResponse(402, {}));
		expect(await client.pay("drf_1", "HDR")).toEqual({
			ok: false,
			error: "payment failed: unknown reason",
		});
	});

	test("a 201 with an unreadable body is settled: check get_task, never failed", async () => {
		answer(() => new Response("not json", { status: 201 }));

		const paid = await client.pay("drf_1", "HDR");

		expect(paid).toEqual({
			ok: false,
			error: "payment settled, but the order could not be read: call get_task",
		});
		expect(paid.ok ? "" : paid.error).not.toContain("failed");
	});
});
