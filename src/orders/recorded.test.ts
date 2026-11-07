// What a paid order records: tasks, deadlines, payer and refund wallet (ADR 0022, ADR 0036).
import { describe, expect, test } from "vitest";
import { tasksByOrder } from "../tasks/index.js";
import {
	createDraft,
	createTestGateway,
	expectJson,
	payDraft,
	paymentFor,
	registerFirm,
	settleAs,
	type TestGateway,
	type TestWallet,
	textField,
	WALLETS,
} from "../testing/index.js";
import { orderById } from "./orderRepo.js";

const payAs = async (gateway: TestGateway, payer: TestWallet) => {
	const firm = await registerFirm(gateway.app, WALLETS.firm);
	const draftId = textField(
		await createDraft(gateway.app, firm.mcpToken),
		"draftId",
	);
	const header = await paymentFor(gateway.app, draftId, payer, "order");
	gateway.clock.advance(5_000);
	const paidAt = gateway.clock.now();
	const paid = await expectJson(
		await payDraft(gateway.app, draftId, header),
		201,
	);
	const orderId = textField(paid, "orderId");
	return { orderId, paidAt, tasks: tasksByOrder(gateway.database, orderId) };
};

describe("recorded order", () => {
	test("a paid order creates N open tasks with claim deadline = payment time + claim window and refund wallet = firm login wallet", async () => {
		const gateway = createTestGateway();
		const { paidAt, tasks } = await payAs(gateway, WALLETS.firm);
		const deadline = paidAt + gateway.config.claimWindowSeconds * 1000;

		expect(tasks.map((task) => task.targetLang)).toEqual(["es", "fr"]);
		for (const task of tasks) {
			expect(task.state).toBe("open");
			expect(task.claimDeadline).toBe(deadline);
			expect(task.refundWallet).toBe(WALLETS.firm.address);
			expect(task.priceUnits).toBe(500_000n);
		}
	});

	test("an order paid by another wallet (the auto-pay delegate) stores it as payer and still refunds the firm's login wallet", async () => {
		const gateway = createTestGateway();
		settleAs(gateway, WALLETS.agent);
		const { orderId, tasks } = await payAs(gateway, WALLETS.agent);

		expect(orderById(gateway.database, orderId)?.payer).toBe(
			WALLETS.agent.address,
		);
		expect(tasks).toHaveLength(2);
		for (const task of tasks) {
			expect(task.refundWallet).toBe(WALLETS.firm.address);
		}
		gateway.clock.advance(gateway.config.claimWindowSeconds * 1000);
		await gateway.worker.tick();
		const refunds = gateway.chain.calls.filter(
			(call) => call.method === "signPayout",
		);
		expect(refunds).toHaveLength(2);
		for (const call of refunds) {
			expect(call.args).toEqual([
				expect.objectContaining({
					legs: [{ ownerWallet: WALLETS.firm.address, amountUnits: 500_000n }],
				}),
			]);
		}
	});
});
