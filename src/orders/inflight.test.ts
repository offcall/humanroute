// The in-flight lock while a settlement is pending (failure table row 17, ADR 0022).
import { describe, expect, test } from "vitest";
import {
	createDraft,
	createTestGateway,
	expectJson,
	holdSettle,
	payDraft,
	paymentFor,
	registerFirm,
	type TestGateway,
	textField,
	WALLETS,
} from "../testing/index.js";

const twoDrafts = async (gateway: TestGateway): Promise<[string, string]> => {
	const firm = await registerFirm(gateway.app, WALLETS.firm);
	const draftOf = async () =>
		textField(await createDraft(gateway.app, firm.mcpToken), "draftId");
	return [await draftOf(), await draftOf()];
};

const inProgress = { error: "payment_in_progress" };

describe("in-flight settlement", () => {
	test("a second request for a draft that is still settling answers 409 payment_in_progress", async () => {
		const gateway = createTestGateway();
		const [draftId] = await twoDrafts(gateway);
		const header = await paymentFor(gateway.app, draftId, WALLETS.firm, "a");
		const other = await paymentFor(gateway.app, draftId, WALLETS.firm, "b");
		const held = holdSettle(gateway);

		const first = payDraft(gateway.app, draftId, header);
		await held.started;
		for (const sent of [header, other]) {
			const again = await payDraft(gateway.app, draftId, sent);
			expect(await expectJson(again, 409)).toEqual(inProgress);
		}
		held.release();
		await expectJson(await first, 201);
		expect(gateway.facilitator.calls.settle).toBe(1);
	});

	test("one payment cannot settle against two different unpaid drafts concurrently", async () => {
		const gateway = createTestGateway();
		const [draftA, draftB] = await twoDrafts(gateway);
		const header = await paymentFor(gateway.app, draftA, WALLETS.firm, "a");
		const held = holdSettle(gateway);

		const first = payDraft(gateway.app, draftA, header);
		await held.started;
		const during = await payDraft(gateway.app, draftB, header);
		expect(await expectJson(during, 409)).toEqual(inProgress);
		held.release();
		await expectJson(await first, 201);

		const after = await payDraft(gateway.app, draftB, header);
		expect(await expectJson(after, 409)).toEqual({ error: "payment_reused" });
		expect(gateway.facilitator.calls.settle).toBe(1);
	});
});
