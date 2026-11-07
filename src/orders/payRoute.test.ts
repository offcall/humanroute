// POST /x/orders/:draftId refusals before the facilitator and by verify (failure table rows 3, 4, 16).
// Settle failures: settleUnknown.test.ts.
import { describe, expect, test } from "vitest";
import {
	createDraft,
	createTestGateway,
	expectJson,
	payDraft,
	paymentFor,
	registerFirm,
	rowCount,
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

const expectNothingRecorded = (gateway: TestGateway) => {
	for (const table of ["orders", "tasks", "payments", "orphans"]) {
		expect(rowCount(gateway, table)).toBe(0);
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
	test("answers 404 for an unknown or expired draft without verify or settle", async () => {
		const gateway = createTestGateway();
		const { draftId, header } = await draftWithPayment(gateway);
		const unknown = await payDraft(gateway.app, "no-such-draft", header);
		expect(await expectJson(unknown, 404)).toEqual({ error: "not_found" });

		gateway.clock.advance(gateway.config.draftTtlSeconds * 1000);
		const expired = await payDraft(gateway.app, draftId, header);
		expect(await expectJson(expired, 404)).toEqual({ error: "not_found" });
		expect(gateway.facilitator.calls).toEqual({ verify: 0, settle: 0 });
	});

	test("answers 503 not_ready with reasons and Retry-After 30 while the preflight fails", async () => {
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

	test("refuses a payment whose accepted amount differs from the draft total before the facilitator", async () => {
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

	test("answers 402 and records nothing when verify says invalid", async () => {
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
});
