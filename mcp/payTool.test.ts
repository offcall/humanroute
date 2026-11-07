import { VersionedTransaction } from "@solana/web3.js";
import { parsePaymentPayload } from "@x402/core/schemas";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
	AMOUNT,
	FEE_PAYER,
	fakePayClient,
	offerFor,
	signMessage,
	unsignedFor,
} from "./fakePayment.js";
import { callTool, connectTools, replyOf } from "./fakeServer.js";
import { jsonResponse, nth, stubFetch } from "./fakes.js";
import { createPayClient } from "./payGateway.js";
import { payUnknown } from "./payParse.js";
import { pay } from "./payTool.js";
import { registerPayTools } from "./payTools.js";
import { type PayClient, PayOutcome } from "./payTypes.js";
import { PREPARED_TTL_MS } from "./pending.js";
import { prepare } from "./prepareTool.js";

const DRAFT = "drf_1";
const PAID = {
	ok: true,
	value: {
		outcome: PayOutcome.Paid,
		order: { orderId: "ord_1", payTx: "tx1" },
	},
} as const;
const unsigned = unsignedFor();
const SIGNATURE = signMessage(unsigned.message);

// The prepared map lives in module memory; every test uses its own token.
let token = "";
let tokenCount = 0;
beforeEach(() => {
	tokenCount += 1;
	token = `tok_${tokenCount}`;
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const payClient = (script: Partial<PayClient> = {}) =>
	fakePayClient({
		offer: async () => ({ ok: true, value: offerFor() }),
		unsigned: async () => ({ ok: true, value: unsigned }),
		pay: async () => PAID,
		...script,
	});

const prepared = async (client: PayClient, now = 0) =>
	replyOf(await prepare(client, token, DRAFT, now));

const paid = async (client: PayClient, now = 0, at = token) =>
	replyOf(await pay(client, at, DRAFT, SIGNATURE, now));

describe("prepare_payment", () => {
	test("prepare_payment returns the sign command with the message and stores expiry from the call's start + 2 min", async () => {
		let clock = 1000;
		const { client } = payClient({
			offer: async () => {
				clock += 100_000;
				return { ok: true, value: offerFor() };
			},
		});
		const { client: mcp } = await connectTools((server) =>
			registerPayTools(server, token, client, () => clock),
		);

		const reply = await callTool(mcp, "prepare_payment", { draftId: DRAFT });

		expect(reply.isError).toBe(false);
		expect(reply.text).toContain(
			`node ~/.humanroute/sign.mjs ${unsigned.message}`,
		);
		expect(reply.text).toContain("2.00 USDC");
		// The offer took 100 s; the 2 min still count from the call's start at 1000.
		expect((await paid(client, 1000 + PREPARED_TTL_MS)).text).toContain(
			"no prepared payment",
		);
		expect((await paid(client, 1000 + PREPARED_TTL_MS - 1)).isError).toBe(
			false,
		);
	});

	test.each([
		["amount", { amountUnits: "2000001" }],
		["payTo", { payTo: FEE_PAYER.toBase58() }],
	])(
		"prepare_payment refuses when %s differs from the 402 offer",
		async (_field, change) => {
			const { client, calls } = payClient({
				unsigned: async () => ({ ok: true, value: { ...unsigned, ...change } }),
			});

			const reply = await prepared(client);

			expect(reply.isError).toBe(true);
			expect(reply.text).toContain("does not match the gateway's offer");
			expect((await paid(client)).text).toContain("no prepared payment");
			expect(calls.filter((call) => call.method === "pay")).toHaveLength(0);
		},
	);

	test("prepare_payment refuses an offer without a fee payer", async () => {
		const { client, calls } = payClient({
			offer: async () => ({ ok: true, value: offerFor(AMOUNT, {}) }),
		});

		const reply = await prepared(client);

		expect(reply).toEqual({
			isError: true,
			text: "the gateway's payment offer has no fee payer",
		});
		expect(calls.map((call) => call.method)).toEqual(["offer"]);
	});
});

describe("pay_task", () => {
	test("pay_task refuses without a prepared payment or at expiry", async () => {
		const { client, calls } = payClient();

		expect((await paid(client)).isError).toBe(true);
		await prepared(client, 0);
		expect((await paid(client, PREPARED_TTL_MS)).text).toContain(
			"no prepared payment for this draft, or it expired",
		);
		expect((await paid(client, PREPARED_TTL_MS - 1)).isError).toBe(false);
		expect(calls.filter((call) => call.method === "pay")).toHaveLength(1);
	});

	test("pay_task sends PAYMENT-SIGNATURE echoing the gateway's accepted requirement and resource", async () => {
		const { client, calls } = payClient();
		await prepared(client);

		await paid(client);

		const [draftId, header] = nth(
			calls.filter((call) => call.method === "pay"),
			0,
		).args;
		expect(draftId).toBe(DRAFT);
		const payload: unknown = JSON.parse(
			Buffer.from(String(header), "base64").toString("utf8"),
		);
		const offer = offerFor();
		expect(payload).toEqual({
			x402Version: 2,
			resource: offer.resource,
			accepted: offer.accepted,
			payload: { transaction: expect.any(String) },
		});
		const parsed = parsePaymentPayload(payload);
		const transaction = parsed.success
			? parsed.data.payload.transaction
			: undefined;
		if (typeof transaction !== "string") {
			throw new Error("PAYMENT-SIGNATURE has no transaction");
		}
		const sent = VersionedTransaction.deserialize(
			Buffer.from(transaction, "base64"),
		);
		expect(Buffer.from(nth(sent.signatures, 1)).toString("base64")).toBe(
			SIGNATURE,
		);
		expect(Buffer.from(sent.message.serialize()).toString("base64")).toBe(
			unsigned.message,
		);
	});

	test("pay_task tells Claude to prepare again only after a definitive simulation failure", async () => {
		const reason = Buffer.from(
			JSON.stringify({
				success: false,
				errorReason: "transaction_simulation_failed",
			}),
		).toString("base64");
		stubFetch(async () =>
			jsonResponse(402, {}, { "PAYMENT-RESPONSE": reason }),
		);
		const real = createPayClient("https://gateway.test");
		const { client } = payClient({ pay: real.pay });
		await prepared(client);

		const reply = await paid(client);

		expect(reply.isError).toBe(true);
		expect(reply.text).toContain(
			"payment failed: transaction_simulation_failed",
		);
		expect(reply.text).toContain("call prepare_payment again");
		expect(reply.text).not.toContain("may have settled");
		stubFetch(async () =>
			jsonResponse(201, { orderId: "ord_1", payTx: "tx1" }),
		);
		expect((await paid(client)).text).toContain("payTx tx1");
	});

	test.each([
		["a 5xx", payUnknown("gateway answered HTTP 502: simulation")],
		["a timeout", payUnknown("gateway did not answer in time (simulation)")],
		[
			"a connection error",
			payUnknown("gateway is unreachable during simulation"),
		],
	])(
		"an unknown payment outcome containing simulation never invites prepare again (%s)",
		async (_name, error) => {
			const { client } = payClient({ pay: async () => ({ ok: false, error }) });
			await prepared(client);

			const reply = await paid(client);

			expect(reply.isError).toBe(true);
			expect(reply.text).toContain(
				"ask before calling prepare_payment or pay_task again",
			);
			expect(reply.text).not.toContain("call prepare_payment again");
		},
	);

	test("a real 5xx with a simulation error code is an unknown outcome", async () => {
		stubFetch(async () =>
			jsonResponse(500, { error: "transaction_simulation_failed" }),
		);
		const real = createPayClient("https://gateway.test");
		const { client } = payClient({ pay: real.pay });
		await prepared(client);

		const reply = await paid(client);

		expect(reply.text).toContain("the payment may have settled");
		expect(reply.text).not.toContain("call prepare_payment again");
	});

	test.each([
		["success", PAID, "no prepared payment"],
		[
			"already-paid",
			{ ok: true, value: { outcome: PayOutcome.AlreadyPaid } },
			"no prepared payment",
		],
	] as const)(
		"pay_task drops the prepared payment after %s",
		async (_name, answer, after) => {
			const { client } = payClient({ pay: async () => answer });
			await prepared(client);

			expect((await paid(client)).isError).toBe(false);
			expect((await paid(client)).text).toContain(after);
		},
	);

	test("pay_task keeps the prepared payment after a refusal", async () => {
		let answer: Awaited<ReturnType<PayClient["pay"]>> = {
			ok: false,
			error: "payment refused: bad_payment",
		};
		const { client } = payClient({ pay: async () => answer });
		await prepared(client);

		expect((await paid(client)).text).toBe("payment refused: bad_payment.");
		answer = PAID;
		expect((await paid(client)).text).toContain("orderId ord_1");
	});

	test("prepared payments are keyed by token and draft, so another firm's token cannot use them", async () => {
		const { client, calls } = payClient();
		await prepared(client);

		expect((await paid(client, 0, `${token}_other`)).text).toContain(
			"no prepared payment",
		);
		expect(
			replyOf(await pay(client, token, "drf_other", SIGNATURE, 0)).isError,
		).toBe(true);
		expect(calls.filter((call) => call.method === "pay")).toHaveLength(0);
		expect((await paid(client)).text).toContain("orderId ord_1");
	});
});
