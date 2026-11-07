// The public draft read reports orphans and settling, so nobody is offered Pay again (ADR 0042).
import { describe, expect, test } from "vitest";
import {
	createDraft,
	createTestGateway,
	expectJson,
	holdSettle,
	payDraft,
	paymentFor,
	registerFirm,
	send,
	type TestGateway,
	textField,
	WALLETS,
} from "../testing/index.js";

const TTL_MS = 1800 * 1000;

const firmDrafts = async (
	gateway: TestGateway,
): Promise<() => Promise<string>> => {
	const firm = await registerFirm(gateway.app, WALLETS.firm);
	return async () =>
		textField(await createDraft(gateway.app, firm.mcpToken), "draftId");
};

const readDraft = async (gateway: TestGateway, draftId: string) =>
	expectJson(
		await send(gateway.app, "GET", `/api/orders/draft/${draftId}`),
		200,
	);

// Pays the draft while settle answers with `transaction` on another network: an orphan.
const payAsOrphan = async (
	gateway: TestGateway,
	draftId: string,
	transaction: string,
): Promise<void> => {
	const header = await paymentFor(gateway.app, draftId, WALLETS.firm, "a");
	gateway.facilitator.answer.settle = async () => ({
		success: true,
		transaction,
		network: "solana:mainnet",
		payer: WALLETS.firm.address,
	});
	const res = await payDraft(gateway.app, draftId, header);
	expect(await expectJson(res, 502)).toMatchObject({ error: "orphan_payment" });
};

describe("public draft state", () => {
	test("a draft whose payment became an orphan reads orphaned with its payTx, also after the TTL", async () => {
		const gateway = createTestGateway();
		const newDraft = await firmDrafts(gateway);
		const draftId = await newDraft();
		const other = await newDraft();
		await payAsOrphan(gateway, draftId, "orphan-tx-1");

		const draft = await readDraft(gateway, draftId);
		expect(draft).toMatchObject({ state: "orphaned", payTx: "orphan-tx-1" });
		expect(draft.orderId).toBeUndefined();
		expect(await readDraft(gateway, other)).toMatchObject({ state: "draft" });
		expect((await readDraft(gateway, other)).payTx).toBeUndefined();

		gateway.clock.advance(TTL_MS);
		expect(await readDraft(gateway, draftId)).toMatchObject({
			state: "orphaned",
		});
		const gone = await send(gateway.app, "GET", `/api/orders/draft/${other}`);
		expect(await expectJson(gone, 404)).toEqual({ error: "not_found" });
	});

	test("an orphan without a settle transaction reads orphaned with payTx null", async () => {
		const gateway = createTestGateway();
		const draftId = await (await firmDrafts(gateway))();
		await payAsOrphan(gateway, draftId, "");

		expect(await readDraft(gateway, draftId)).toMatchObject({
			state: "orphaned",
			payTx: null,
		});
	});

	test("a draft reads settling while its settlement is held, then paid", async () => {
		const gateway = createTestGateway();
		const draftId = await (await firmDrafts(gateway))();
		const header = await paymentFor(gateway.app, draftId, WALLETS.firm, "a");
		const held = holdSettle(gateway);

		const paying = payDraft(gateway.app, draftId, header);
		await held.started;
		expect(await readDraft(gateway, draftId)).toMatchObject({
			state: "settling",
		});
		held.release();
		await expectJson(await paying, 201);
		expect(await readDraft(gateway, draftId)).toMatchObject({ state: "paid" });
	});
});
