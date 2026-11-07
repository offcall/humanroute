// Order recording is atomic (ADR 0022): a failure part-way leaves no rows, only an orphan.
import { describe, expect, test } from "vitest";
import {
	createDraft,
	createTestGateway,
	expectJson,
	payDraft,
	paymentFor,
	registerFirm,
	send,
	type TestGateway,
	textField,
	WALLETS,
} from "../testing/index.js";

const FAIL_SECOND_TASK = `CREATE TRIGGER fail_fr BEFORE INSERT ON tasks
  WHEN NEW.target_lang = 'fr' BEGIN SELECT RAISE(ABORT, 'disk full'); END`;
const FAIL_ORPHAN = `CREATE TRIGGER fail_orphan BEFORE INSERT ON orphans
  BEGIN SELECT RAISE(ABORT, 'disk full'); END`;

const count = (gateway: TestGateway, table: string): unknown =>
	gateway.database
		.prepare(`SELECT COUNT(*) AS total FROM ${table}`)
		.pluck()
		.get();

const payWithFailingTasks = async (gateway: TestGateway) => {
	const firm = await registerFirm(gateway.app, WALLETS.firm);
	const draftId = textField(
		await createDraft(gateway.app, firm.mcpToken),
		"draftId",
	);
	const header = await paymentFor(gateway.app, draftId, WALLETS.firm, "a");
	gateway.database.exec(FAIL_SECOND_TASK);
	const res = await payDraft(gateway.app, draftId, header);
	const draft = await expectJson(
		await send(gateway.app, "GET", `/api/orders/draft/${draftId}`),
		200,
	);
	return { res, draft };
};

const expectNothingRecorded = (gateway: TestGateway) => {
	for (const table of ["orders", "tasks", "payments"]) {
		expect(count(gateway, table)).toBe(0);
	}
};

describe("recordOrder atomicity", () => {
	test("a later task-insert failure rolls back the complete order", async () => {
		const gateway = createTestGateway();
		const { res, draft } = await payWithFailingTasks(gateway);

		expect(await expectJson(res, 502)).toEqual({
			error: "orphan_payment",
			payTx: "pay-tx-1",
		});
		expectNothingRecorded(gateway);
		expect(draft.state).toBe("orphaned");
		expect(draft.payTx).toBe("pay-tx-1");
		expect(draft.orderId).toBeUndefined();
		const orphan = gateway.database.prepare("SELECT * FROM orphans").get();
		expect(orphan).toEqual(
			expect.objectContaining({ pay_tx: "pay-tx-1", reason: "record_failed" }),
		);
	});

	test("still reports an orphan if orphan storage fails", async () => {
		const gateway = createTestGateway();
		gateway.database.exec(FAIL_ORPHAN);
		const { res, draft } = await payWithFailingTasks(gateway);

		expect(await expectJson(res, 502)).toEqual({
			error: "orphan_payment",
			payTx: "pay-tx-1",
		});
		expectNothingRecorded(gateway);
		expect(count(gateway, "orphans")).toBe(0);
		expect(draft.state).toBe("draft");
		const operator = gateway.logs.filter((line) =>
			line.includes("OPERATOR ACTION REQUIRED orphan payment"),
		);
		expect(operator).toEqual([
			`[orders] OPERATOR ACTION REQUIRED orphan payment transaction=pay-tx-1 payer=${WALLETS.firm.address} not stored: disk full`,
		]);
	});
});
