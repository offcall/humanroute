// Checks of the test gateway itself: it starts offline and the x402 middleware accepts the fake
// facilitator (failure table: pay without header).
import { describe, expect, test } from "vitest";
import {
	createDraft,
	createTestGateway,
	expectJson,
	readOffer,
	registerFirm,
	send,
	textField,
	WALLETS,
} from "./index.js";

describe("test gateway", () => {
	test("starts ready and reports preflight problems on /health", async () => {
		const gateway = createTestGateway();
		const health = () => send(gateway.app, "GET", "/health");

		const ready = await expectJson(await health(), 200);
		expect(ready).toEqual({ ok: true, ready: true });

		gateway.problems.push("hold wallet needs at least 0.05 SOL for fees");
		const failing = await expectJson(await health(), 200);
		expect(failing).toEqual({ ok: true, ready: false });
	});

	test("answers a payment without header with 402 and the fake fee payer", async () => {
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
});
