// Replay and conflicts of one payment (failure table rows 5-7, ADR 0004, ADR 0022).
import { describe, expect, it } from "vitest";
import {
	createDraft,
	createTestGateway,
	expectJson,
	LEAFLET,
	payDraft,
	paymentFor,
	registerFirm,
	send,
	type TestGateway,
	textField,
	WALLETS,
} from "../testing/index.js";

// Targets out of language order, so an input-order receipt differs from a sorted one.
const FR_ES = { ...LEAFLET, targets: [...LEAFLET.targets].reverse() };

const rowCount = (gateway: TestGateway, table: string): unknown =>
	gateway.database.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get();

// The same JSON with another key order and spacing: a different header, the same message.
const reserialized = (header: string): string => {
	const raw: unknown = JSON.parse(Buffer.from(header, "base64").toString());
	const pretty = JSON.stringify(raw, null, 2);
	return Buffer.from(pretty).toString("base64");
};

const paidDraft = async (gateway: TestGateway, memo: string) => {
	const firm = await registerFirm(gateway.app, WALLETS.firm);
	const draftId = textField(
		await createDraft(gateway.app, firm.mcpToken, FR_ES),
		"draftId",
	);
	const header = await paymentFor(gateway.app, draftId, WALLETS.firm, memo);
	const other = await paymentFor(gateway.app, draftId, WALLETS.firm, "other");
	const first = await payDraft(gateway.app, draftId, header);
	return { firm, draftId, header, other, first };
};

describe("payment replay and conflicts", () => {
	it("OR-20 the same payment for the same draft returns the same 201 without a second settlement", async () => {
		const gateway = createTestGateway();
		const { draftId, header, first } = await paidDraft(gateway, "first");
		expect(first.headers.get("PAYMENT-RESPONSE")).not.toBeNull();
		const receipt = await expectJson(first, 201);

		for (const replayed of [header, reserialized(header)]) {
			const again = await payDraft(gateway.app, draftId, replayed);
			expect(await expectJson(again, 201)).toEqual(receipt);
		}
		expect(gateway.facilitator.calls.settle).toBe(1);
		expect(gateway.facilitator.calls.verify).toBe(1);
	});

	it("OR-21 a different payment for a paid draft answers 409 draft_paid before the facilitator", async () => {
		const gateway = createTestGateway();
		const { draftId, other, first } = await paidDraft(gateway, "first");
		await expectJson(first, 201);

		const conflict = await payDraft(gateway.app, draftId, other);
		expect(await expectJson(conflict, 409)).toEqual({ error: "draft_paid" });
		const bare = await send(gateway.app, "POST", `/x/orders/${draftId}`);
		expect(await expectJson(bare, 409)).toEqual({ error: "draft_paid" });
		expect(gateway.facilitator.calls).toEqual({ verify: 1, settle: 1 });
	});

	it("OR-22 the same payment for another draft answers 409 payment_reused and records nothing", async () => {
		const gateway = createTestGateway();
		const { firm, header, first } = await paidDraft(gateway, "first");
		await expectJson(first, 201);
		const before = ["orders", "tasks", "payments", "orphans"].map((table) =>
			rowCount(gateway, table),
		);
		const second = textField(
			await createDraft(gateway.app, firm.mcpToken, FR_ES),
			"draftId",
		);

		const reused = await payDraft(gateway.app, second, header);
		expect(await expectJson(reused, 409)).toEqual({ error: "payment_reused" });
		const after = ["orders", "tasks", "payments", "orphans"].map((table) =>
			rowCount(gateway, table),
		);
		expect(after).toEqual(before);
		expect(gateway.facilitator.calls).toEqual({ verify: 1, settle: 1 });
	});
});
