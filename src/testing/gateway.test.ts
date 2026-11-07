// Checks of the test gateway itself: it starts offline, the x402 middleware accepts the fake
// facilitator, and a payment through it records an order (failure table: pay without header).
import { describe, expect, it } from "vitest";
import {
	createDraft,
	createTestGateway,
	expectJson,
	listField,
	payDraft,
	paymentFor,
	readOffer,
	registerFirm,
	send,
	textField,
	WALLETS,
} from "./index.js";

describe("test gateway", () => {
	it("H-01 starts ready and reports preflight problems on /health", async () => {
		const gateway = createTestGateway();
		const health = () => send(gateway.app, "GET", "/health");

		const ready = await expectJson(await health(), 200);
		expect(ready).toEqual({ ok: true, ready: true });

		gateway.problems.push("hold wallet needs at least 0.05 SOL for fees");
		const failing = await expectJson(await health(), 200);
		expect(failing).toEqual({ ok: true, ready: false });
	});

	it("H-02 answers a payment without header with 402 and the fake fee payer", async () => {
		const gateway = createTestGateway();
		const firm = await registerFirm(gateway.app, WALLETS.firm);
		const draft = await createDraft(gateway.app, firm.mcpToken);
		expect(draft.autopay).toBe("unavailable");

		const draftId = textField(draft, "draftId");
		const res = await send(gateway.app, "POST", `/x/orders/${draftId}`);
		expect(res.status).toBe(402);

		const { accepted } = readOffer(res);
		expect(accepted.scheme).toBe("exact");
		expect(accepted.network).toBe(gateway.config.network);
		expect(accepted.amount).toBe("1000000");
		expect(accepted.payTo).toBe(WALLETS.hold.address);
		expect(accepted.asset).toBe(gateway.config.usdcMint);
		expect(accepted.extra?.feePayer).toBe(WALLETS.facilitator.address);
		expect(gateway.facilitator.calls.verify).toBe(0);
		expect(gateway.facilitator.calls.settle).toBe(0);
	});

	it("H-03 records an order with one open task per language once the fake settles", async () => {
		const { app, facilitator } = createTestGateway();
		const firm = await registerFirm(app, WALLETS.firm);
		const draftId = textField(await createDraft(app, firm.mcpToken), "draftId");
		const header = await paymentFor(app, draftId, WALLETS.firm, "first");

		const paid = await expectJson(await payDraft(app, draftId, header), 201);
		expect(facilitator.calls.settle).toBe(1);

		const orderPath = `/api/orders/${textField(paid, "orderId")}`;
		const order = await expectJson(
			await send(app, "GET", orderPath, { bearer: firm.mcpToken }),
			200,
		);
		const states = listField(order, "tasks").map((task) => [
			task.targetLang,
			task.publicState,
		]);
		expect(states).toEqual([
			["es", "open"],
			["fr", "open"],
		]);
		expect(order.payer).toBe(WALLETS.firm.address);
	});
});
