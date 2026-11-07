// A failed settle: a verify refusal stays 402, anything that may have broadcast is an orphan
// settle_unknown that blocks the draft (ADR 0043, failure table).
import { FacilitatorResponseError } from "@x402/core/server";
import { FacilitatorTimeoutError, SettleError } from "@x402/core/types";
import { describe, expect, test, vi } from "vitest";
import {
	createDraft,
	createTestGateway,
	expectJson,
	payDraft,
	paymentFor,
	registerFirm,
	rowCount,
	send,
	type TestGateway,
	textField,
	WALLETS,
} from "../testing/index.js";

type Settle = TestGateway["facilitator"]["answer"]["settle"];

// One draft and two different payment headers for it, both made while it is still payable.
const draftWithPayments = async (gateway: TestGateway) => {
	const firm = await registerFirm(gateway.app, WALLETS.firm);
	const draftId = textField(
		await createDraft(gateway.app, firm.mcpToken),
		"draftId",
	);
	const header = await paymentFor(gateway.app, draftId, WALLETS.firm, "a");
	const other = await paymentFor(gateway.app, draftId, WALLETS.firm, "b");
	return { draftId, header, other };
};

const failed =
	(errorReason: string, transaction = ""): Settle =>
	async () => ({
		success: false,
		errorReason,
		transaction,
		network: "solana:devnet",
		payer: WALLETS.firm.address,
	});

const thrown =
	(error: Error): Settle =>
	async () => {
		throw error;
	};

const settleError = new SettleError(500, {
	success: false,
	errorReason: "unexpected_settle_error",
	transaction: "",
	network: "solana:devnet",
});

describe("settle outcome", () => {
	test.each<[string, Settle]>([
		["a payload mismatch", failed("invalid_exact_svm_payload_amount_mismatch")],
		[
			"a failed simulation",
			failed("invalid_exact_svm_transaction_simulation_failed"),
		],
	])(
		"a settle refused by the facilitator's verify (%s) answers 402, records nothing, and the draft can be paid again",
		async (_name, refusal) => {
			const gateway = createTestGateway();
			const { draftId, header } = await draftWithPayments(gateway);
			const settle = gateway.facilitator.answer.settle;
			gateway.facilitator.answer.settle = refusal;

			const res = await payDraft(gateway.app, draftId, header);
			expect(res.status).toBe(402);
			for (const table of ["orders", "tasks", "payments", "orphans"]) {
				expect(rowCount(gateway, table)).toBe(0);
			}
			gateway.facilitator.answer.settle = settle;
			await expectJson(await payDraft(gateway.app, draftId, header), 201);
		},
	);

	test.each<[string, Settle, string | null]>([
		["settlement_pending", failed("settlement_pending", "sig-1"), "sig-1"],
		["a send failure", failed("invalid_exact_svm_transaction_failed"), null],
		[
			"a refusal reason with a transaction",
			failed("invalid_x", "sig-2"),
			"sig-2",
		],
		["duplicate_settlement", failed("duplicate_settlement"), null],
		["a broken connection", thrown(new Error("fetch failed")), null],
		["a facilitator 5xx", thrown(settleError), null],
		["a timeout", thrown(new FacilitatorTimeoutError("settle", 90000)), null],
		["an invalid answer", thrown(new FacilitatorResponseError("HTML")), null],
	])(
		"a settle that may have broadcast (%s) is an orphan settle_unknown answering 502 orphan_payment",
		async (_name, outcome, payTx) => {
			vi.spyOn(console, "error").mockImplementation(() => {});
			const gateway = createTestGateway();
			const { draftId, header } = await draftWithPayments(gateway);
			gateway.facilitator.answer.settle = outcome;

			const res = await payDraft(gateway.app, draftId, header);
			expect(res.headers.get("PAYMENT-RESPONSE")).toBeNull();
			expect(await expectJson(res, 502)).toEqual({
				error: "orphan_payment",
				payTx,
			});
			const orphans = gateway.database.prepare("SELECT * FROM orphans").all();
			expect(orphans).toEqual([
				expect.objectContaining({
					pay_tx: payTx,
					reason: "settle_unknown",
					draft_id: draftId,
					resolved_at: null,
				}),
			]);
			for (const table of ["orders", "tasks", "payments"]) {
				expect(rowCount(gateway, table)).toBe(0);
			}
			const read = await send(
				gateway.app,
				"GET",
				`/api/orders/draft/${draftId}`,
			);
			expect(await expectJson(read, 200)).toMatchObject({
				state: "orphaned",
				payTx,
			});
		},
	);

	test("an orphaned draft answers 502 orphan_payment to the same or a new payment without the facilitator", async () => {
		const gateway = createTestGateway();
		const { draftId, header, other } = await draftWithPayments(gateway);
		gateway.facilitator.answer.settle = failed("settlement_pending", "sig-1");
		await expectJson(await payDraft(gateway.app, draftId, header), 502);
		const calls = { ...gateway.facilitator.calls };

		for (const retry of [header, other]) {
			const res = await payDraft(gateway.app, draftId, retry);
			expect(await expectJson(res, 502)).toEqual({
				error: "orphan_payment",
				payTx: "sig-1",
			});
		}
		const offer = await send(gateway.app, "POST", `/x/orders/${draftId}`);
		expect(offer.status).toBe(502);
		expect(gateway.facilitator.calls).toEqual(calls);
		expect(rowCount(gateway, "orphans")).toBe(1);
	});

	test("a draft reads settling during an unknown settle and orphaned after it", async () => {
		const gateway = createTestGateway();
		const { draftId, header } = await draftWithPayments(gateway);
		gateway.facilitator.answer.settle = async () => {
			const read = await send(
				gateway.app,
				"GET",
				`/api/orders/draft/${draftId}`,
			);
			expect(await expectJson(read, 200)).toMatchObject({ state: "settling" });
			throw new Error("socket hang up");
		};
		vi.spyOn(console, "error").mockImplementation(() => {});

		await expectJson(await payDraft(gateway.app, draftId, header), 502);
		const read = await send(gateway.app, "GET", `/api/orders/draft/${draftId}`);
		expect(await expectJson(read, 200)).toMatchObject({ state: "orphaned" });
	});
});
