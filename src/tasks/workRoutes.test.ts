// POST /api/tasks/:id/submit (ADR 0023): failure table rows 20 (late) and the result bounds.
import { describe, expect, it } from "vitest";
import {
	createDraft,
	createTestGateway,
	expectJson,
	joinLinguist,
	listField,
	payDraft,
	paymentFor,
	registerAgency,
	registerFirm,
	send,
	type TestGateway,
	testWallet,
	textField,
	WALLETS,
} from "../testing/index.js";

const WORK_WINDOW_MS = 180_000;

type Scene = TestGateway & { linguist: string; taskId: string };

// One paid order, the en→es task claimed by the agency's linguist; the payer is not the firm.
const claimedTask = async (): Promise<Scene> => {
	const gateway = createTestGateway();
	const { app, facilitator } = gateway;
	const network = gateway.config.network;
	const payer = WALLETS.agent.address;
	facilitator.answer.verify = async () => ({ isValid: true, payer });
	facilitator.answer.settle = async () => ({
		success: true,
		transaction: "pay-tx-agent",
		network,
		payer,
	});
	const firm = await registerFirm(app, WALLETS.firm);
	const agency = await registerAgency(app, WALLETS.agency);
	const pairs = [{ source: "en", target: "es" }];
	const linguist = await joinLinguist(
		app,
		WALLETS.linguist,
		agency.inviteCode,
		pairs,
	);
	const draftId = textField(await createDraft(app, firm.mcpToken), "draftId");
	const header = await paymentFor(app, draftId, WALLETS.agent, "order-1");
	const paid = await expectJson(await payDraft(app, draftId, header), 201);
	const order = await expectJson(
		await send(app, "GET", `/api/orders/${textField(paid, "orderId")}`, {
			bearer: firm.mcpToken,
		}),
		200,
	);
	const es = listField(order, "tasks").find((task) => task.targetLang === "es");
	const taskId = textField(es ?? {}, "taskId");
	await expectJson(
		await send(app, "POST", `/api/tasks/${taskId}/claim`, {
			cookie: linguist,
			body: {},
		}),
		200,
	);

	return { ...gateway, linguist, taskId };
};

const submit = (scene: Scene, body: unknown, cookie = scene.linguist) =>
	send(scene.app, "POST", `/api/tasks/${scene.taskId}/submit`, {
		cookie,
		body,
	});

const transfers = (scene: Scene) =>
	scene.database
		.prepare("SELECT kind, memo FROM transfers WHERE task_id = ?")
		.all(scene.taskId);

describe("submit", () => {
	it("TK-20 the claimer submits a result before the work deadline", async () => {
		const scene = await claimedTask();
		scene.clock.advance(WORK_WINDOW_MS - 1);
		const result = "  Tome un comprimido.\n";

		const view = await expectJson(await submit(scene, { result }), 200);
		expect(view).toMatchObject({ state: "submitted", result, transfer: null });
		expect(transfers(scene)).toEqual([]);
	});

	it("TK-21 a submit at or after the work deadline answers 409 late and the task is refunded as :late", async () => {
		const scene = await claimedTask();
		scene.clock.advance(WORK_WINDOW_MS);
		const late = { error: "late" };

		expect(
			await expectJson(await submit(scene, { result: "Hola" }), 409),
		).toEqual(late);
		await scene.worker.tick();
		expect(
			await expectJson(await submit(scene, { result: "Hola" }), 409),
		).toEqual(late);
		await scene.worker.tick();

		const refund = {
			role: "refund",
			wallet: WALLETS.firm.address,
			units: "500000",
		};
		const rows = transfers(scene);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			kind: "refund",
			memo: `hr:${scene.taskId}:late`,
		});
		const legs: unknown = scene.database
			.prepare("SELECT legs FROM transfers WHERE task_id = ?")
			.pluck()
			.get(scene.taskId);
		expect(typeof legs === "string" ? JSON.parse(legs) : legs).toEqual([
			refund,
		]);
	});

	it("TK-22 a submit by another linguist answers 403", async () => {
		const scene = await claimedTask();
		const agency = await registerAgency(scene.app, testWallet(31));
		const other = await joinLinguist(
			scene.app,
			testWallet(32),
			agency.inviteCode,
			[{ source: "en", target: "es" }],
		);

		const res = await submit(scene, { result: "Hola" }, other);
		expect(await expectJson(res, 403)).toEqual({ error: "forbidden" });
	});

	it.each([
		["empty", ""],
		["whitespace-only", " \n\t "],
		["over 20000 characters", "x".repeat(20_001)],
	])("TK-23 a %s result answers 422 invalid_body", async (_name, result) => {
		const scene = await claimedTask();
		const res = await submit(scene, { result });
		expect(await expectJson(res, 422)).toEqual({ error: "invalid_body" });
	});

	it("TK-24 a second submit answers 409 bad_state", async () => {
		const scene = await claimedTask();
		await expectJson(await submit(scene, { result: "Hola" }), 200);
		const again = await submit(scene, { result: "Hola de nuevo" });
		expect(await expectJson(again, 409)).toEqual({ error: "bad_state" });
	});
});
