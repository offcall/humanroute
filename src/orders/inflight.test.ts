// The in-flight lock while a settlement is pending (failure table row 17, ADR 0022).
import type { SettleResponse } from "@x402/core/types";
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

// A settle that waits for release(); `started` resolves once the facilitator was called.
const holdSettle = (gateway: TestGateway) => {
	const settle = gateway.facilitator.answer.settle;
	let release = () => {};
	let markStarted = () => {};
	const released = new Promise<void>((resolve) => {
		release = resolve;
	});
	const started = new Promise<void>((resolve) => {
		markStarted = resolve;
	});
	gateway.facilitator.answer.settle = async (payload, requirements) => {
		markStarted();
		await released;
		return settle(payload, requirements);
	};
	return { started, release: () => release() };
};

const twoDrafts = async (gateway: TestGateway): Promise<[string, string]> => {
	const firm = await registerFirm(gateway.app, WALLETS.firm);
	const draftOf = async () =>
		textField(await createDraft(gateway.app, firm.mcpToken), "draftId");
	return [await draftOf(), await draftOf()];
};

const inProgress = { error: "payment_in_progress" };

describe("in-flight settlement", () => {
	it("OR-23 a second request for a draft that is still settling answers 409 payment_in_progress", async () => {
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

	it("NEW-06 one payment cannot settle against two different unpaid drafts concurrently", async () => {
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

	// SDK handling (verified): success false and a thrown non-facilitator error both answer 402.
	const failures: [string, () => Promise<SettleResponse>][] = [
		[
			"success false",
			async () => ({
				success: false,
				errorReason: "transaction_failed",
				transaction: "",
				network: "solana:devnet",
			}),
		],
		[
			"a rejected settle",
			async () => {
				throw new Error("socket hang up");
			},
		],
	];

	it.each(failures)(
		"OR-25 after a failed settlement (%s) the draft can be paid again",
		async (_name, failing) => {
			vi.spyOn(console, "error").mockImplementation(() => {});
			const gateway = createTestGateway();
			const [draftId] = await twoDrafts(gateway);
			const header = await paymentFor(gateway.app, draftId, WALLETS.firm, "a");
			const settle = gateway.facilitator.answer.settle;
			gateway.facilitator.answer.settle = failing;

			const failed = await payDraft(gateway.app, draftId, header);
			expect(failed.status).toBe(402);
			gateway.facilitator.answer.settle = settle;
			const again = await payDraft(gateway.app, draftId, header);
			await expectJson(again, 201);
			expect(gateway.facilitator.calls.settle).toBe(2);
		},
	);
});
