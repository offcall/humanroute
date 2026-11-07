// POST /x/orders/:draftId refusals before and around the facilitator (failure table rows 3, 4, 16).
import { FacilitatorResponseError } from "@x402/core/server";
import { describe, expect, it, vi } from "vitest";
import {
	createDraft,
	createTestGateway,
	expectJson,
	payDraft,
	paymentFor,
	registerFirm,
	type TestGateway,
	textField,
	WALLETS,
} from "../testing/index.js";
import { isRecord } from "./body.js";

const draftWithPayment = async (gateway: TestGateway) => {
	const firm = await registerFirm(gateway.app, WALLETS.firm);
	const draftId = textField(
		await createDraft(gateway.app, firm.mcpToken),
		"draftId",
	);
	const header = await paymentFor(gateway.app, draftId, WALLETS.firm, "a");
	return { draftId, header };
};

const count = (gateway: TestGateway, table: string): unknown =>
	gateway.database
		.prepare(`SELECT COUNT(*) AS total FROM ${table}`)
		.pluck()
		.get();

const expectNothingRecorded = (gateway: TestGateway) => {
	for (const table of ["orders", "tasks", "payments", "orphans"]) {
		expect(count(gateway, table)).toBe(0);
	}
};

// accepted.amount changed in an otherwise genuine header.
const withAmount = (header: string, amount: string): string => {
	const raw: unknown = JSON.parse(Buffer.from(header, "base64").toString());
	if (!isRecord(raw) || !isRecord(raw.accepted)) {
		throw new Error("the payment header has no accepted offer");
	}
	const payload = { ...raw, accepted: { ...raw.accepted, amount } };
	return Buffer.from(JSON.stringify(payload)).toString("base64");
};

describe("pay route", () => {
	it("OR-11 answers 404 for an unknown or expired draft without verify or settle", async () => {
		const gateway = createTestGateway();
		const { draftId, header } = await draftWithPayment(gateway);
		const unknown = await payDraft(gateway.app, "no-such-draft", header);
		expect(await expectJson(unknown, 404)).toEqual({ error: "not_found" });

		gateway.clock.advance(gateway.config.draftTtlSeconds * 1000);
		const expired = await payDraft(gateway.app, draftId, header);
		expect(await expectJson(expired, 404)).toEqual({ error: "not_found" });
		expect(gateway.facilitator.calls).toEqual({ verify: 0, settle: 0 });
	});

	it("OR-12 answers 503 not_ready with reasons and Retry-After 30 while the preflight fails", async () => {
		const gateway = createTestGateway();
		const { draftId, header } = await draftWithPayment(gateway);
		gateway.problems.push("hold wallet needs at least 0.05 SOL for fees");

		const res = await payDraft(gateway.app, draftId, header);
		expect(res.headers.get("Retry-After")).toBe("30");
		expect(await expectJson(res, 503)).toEqual({
			error: "not_ready",
			reasons: ["hold wallet needs at least 0.05 SOL for fees"],
		});
		expect(gateway.facilitator.calls).toEqual({ verify: 0, settle: 0 });
	});

	it("OR-13 refuses a payment whose accepted amount differs from the draft total before the facilitator", async () => {
		const gateway = createTestGateway();
		const { draftId, header } = await draftWithPayment(gateway);

		const res = await payDraft(
			gateway.app,
			draftId,
			withAmount(header, "999999"),
		);
		expect(res.status).toBe(402);
		expect(gateway.facilitator.calls).toEqual({ verify: 0, settle: 0 });
		expectNothingRecorded(gateway);
	});

	it("OR-14 answers 402 and records nothing when verify says invalid", async () => {
		const gateway = createTestGateway();
		const { draftId, header } = await draftWithPayment(gateway);
		gateway.facilitator.answer.verify = async () => ({
			isValid: false,
			invalidReason: "insufficient_funds",
		});

		const res = await payDraft(gateway.app, draftId, header);
		expect(res.status).toBe(402);
		expect(gateway.facilitator.calls).toEqual({ verify: 1, settle: 0 });
		expectNothingRecorded(gateway);
	});

	it("OR-15 answers 402 and records nothing when settle returns success false", async () => {
		const gateway = createTestGateway();
		const { draftId, header } = await draftWithPayment(gateway);
		gateway.facilitator.answer.settle = async () => ({
			success: false,
			errorReason: "transaction_failed",
			transaction: "",
			network: gateway.config.network,
		});

		const res = await payDraft(gateway.app, draftId, header);
		expect(res.status).toBe(402);
		expect(gateway.facilitator.calls.settle).toBe(1);
		expectNothingRecorded(gateway);
	});

	it("OR-16 a facilitator error during settlement answers 502 without orphan_payment and the draft can be paid again", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const gateway = createTestGateway();
		const { draftId, header } = await draftWithPayment(gateway);
		const settle = gateway.facilitator.answer.settle;
		gateway.facilitator.answer.settle = async () => {
			throw new FacilitatorResponseError("facilitator answered HTML");
		};

		const failed = await payDraft(gateway.app, draftId, header);
		expect(await expectJson(failed, 502)).toEqual({
			error: "facilitator answered HTML",
		});
		expectNothingRecorded(gateway);

		gateway.facilitator.answer.settle = settle;
		await expectJson(await payDraft(gateway.app, draftId, header), 201);
	});
});
