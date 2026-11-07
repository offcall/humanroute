import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import { TransferStatus } from "../store/index.js";
import { taskById } from "../tasks/index.js";
import {
	createDraft,
	createTestGateway,
	expectJson,
	joinLinguist,
	payDraft,
	paymentFor,
	registerAgency,
	registerFirm,
	send,
	type TestGateway,
	textField,
	WALLETS,
} from "../testing/index.js";
import { taskLedger } from "./ledger.js";
import { LegRole, PayoutKind } from "./taskTypes.js";

const CLAIM_MS = 60_000;
const WORK_MS = 180_000;
const PAIRS = [
	{ source: "en", target: "es" },
	{ source: "en", target: "fr" },
];

const people = async (app: Hono) => {
	const firm = await registerFirm(app, WALLETS.firm);
	const agency = await registerAgency(app, WALLETS.agency);
	const linguist = await joinLinguist(
		app,
		WALLETS.linguist,
		agency.inviteCode,
		PAIRS,
	);
	return { firm, linguist };
};

// A paid two-language order; returns the task ids by target language.
const paidOrder = async (
	gateway: TestGateway,
	mcpToken: string,
	memo: string,
) => {
	const { app, database } = gateway;
	const draftId = textField(await createDraft(app, mcpToken), "draftId");
	const header = await paymentFor(app, draftId, WALLETS.firm, memo);
	const paid = await expectJson(await payDraft(app, draftId, header), 201);
	const ids = Array.isArray(paid.taskIds) ? paid.taskIds : [];
	const byLang = new Map<string, string>();
	for (const id of ids) {
		const task = typeof id === "string" ? taskById(database, id) : null;
		if (task) {
			byLang.set(task.targetLang, task.id);
		}
	}
	const es = byLang.get("es");
	const fr = byLang.get("fr");
	if (es === undefined || fr === undefined) {
		throw new Error(`order has no es/fr tasks: ${JSON.stringify(paid)}`);
	}
	return { es, fr };
};

const post = (app: Hono, path: string, cookie: string, body: unknown = {}) =>
	send(app, "POST", path, { cookie, body });

const claim = (app: Hono, taskId: string, cookie: string) =>
	post(app, `/api/tasks/${taskId}/claim`, cookie);

const submitted = async (app: Hono, taskId: string, cookie: string) => {
	await expectJson(await claim(app, taskId, cookie), 200);
	const body = { result: "Tome un comprimido." };
	await expectJson(
		await post(app, `/api/tasks/${taskId}/submit`, cookie, body),
		200,
	);
};

// Pays as WALLETS.agent: the firm's login wallet must still receive refunds (ADR 0036).
const payAsAgent = (gateway: TestGateway) => {
	const payer = WALLETS.agent.address;
	const { answer } = gateway.facilitator;
	answer.verify = async () => ({ isValid: true, payer });
	answer.settle = async () => ({
		success: true,
		transaction: "pay-tx-agent",
		network: gateway.config.network,
		payer,
	});
};

const signing = (gateway: TestGateway) =>
	gateway.chain.calls.filter(
		(call) => call.method === "signPayout" || call.method === "broadcast",
	);

describe("payout decisions", () => {
	test("approving writes one pending payout to the wallets snapshotted at claim and FEE_WALLET with memo hr:<taskId>", async () => {
		const gateway = createTestGateway();
		const { app, database } = gateway;
		const { firm, linguist } = await people(app);
		const { es } = await paidOrder(gateway, firm.mcpToken, "po-10");
		await submitted(app, es, linguist);

		database
			.prepare("UPDATE linguists SET wallet = ?")
			.run(WALLETS.agent.address);
		database
			.prepare("UPDATE agencies SET wallet = ?")
			.run(WALLETS.facilitator.address);
		const callsBefore = gateway.chain.calls.length;

		await expectJson(
			await post(app, `/api/tasks/${es}/approve`, firm.cookie),
			200,
		);

		const transfer = taskLedger(database).byTaskId(es);
		expect(transfer).toMatchObject({
			kind: PayoutKind.Payout,
			status: TransferStatus.Pending,
			memo: `hr:${es}`,
			txSig: null,
			attempts: 0,
			legs: [
				{
					role: LegRole.Linguist,
					wallet: WALLETS.linguist.address,
					units: 400_000n,
				},
				{
					role: LegRole.Agency,
					wallet: WALLETS.agency.address,
					units: 90_000n,
				},
				{ role: LegRole.Fee, wallet: WALLETS.fee.address, units: 10_000n },
			],
		});
		expect(gateway.chain.calls.length).toBe(callsBefore);
		expect(signing(gateway)).toEqual([]);
	});

	test("rejecting writes one pending refund of the full price to the firm's login wallet with memo :rejected", async () => {
		const gateway = createTestGateway();
		const { app, database } = gateway;
		payAsAgent(gateway);
		const { firm, linguist } = await people(app);
		const { es } = await paidOrder(gateway, firm.mcpToken, "po-11");
		await submitted(app, es, linguist);

		const body = { reason: "Wrong dosage terms" };
		await expectJson(
			await post(app, `/api/tasks/${es}/reject`, firm.cookie, body),
			200,
		);

		expect(taskLedger(database).byTaskId(es)).toMatchObject({
			kind: PayoutKind.Refund,
			status: TransferStatus.Pending,
			memo: `hr:${es}:rejected`,
			legs: [
				{ role: LegRole.Refund, wallet: WALLETS.firm.address, units: 500_000n },
			],
		});
		expect(signing(gateway)).toEqual([]);
	});

	test("the decision rolls back when its transfer cannot be written", async () => {
		const gateway = createTestGateway();
		const { app, database } = gateway;
		const { firm, linguist } = await people(app);
		const { es } = await paidOrder(gateway, firm.mcpToken, "po-13");
		await submitted(app, es, linguist);
		const ledger = taskLedger(database);
		const blocker = {
			id: "pre-1",
			taskId: es,
			kind: PayoutKind.Refund,
			legs: [],
			memo: "x",
		};
		ledger.insert(blocker, gateway.clock.now());

		const res = await post(app, `/api/tasks/${es}/approve`, firm.cookie);

		expect(res.status).toBe(500);
		expect(taskById(database, es)?.state).toBe("submitted");
		const all = database.prepare("SELECT id FROM transfers").all();
		expect(all).toEqual([{ id: "pre-1" }]);
	});

	test("an open task is refunded as :unclaimed at its claim deadline and a later claim answers 409 claim_closed", async () => {
		const gateway = createTestGateway();
		const { app, database, clock, worker } = gateway;
		payAsAgent(gateway);
		const { firm, linguist } = await people(app);
		const { es, fr } = await paidOrder(gateway, firm.mcpToken, "po-14");
		const ledger = taskLedger(database);

		clock.advance(CLAIM_MS - 1);
		await expectJson(await claim(app, es, linguist), 200);
		await worker.tick();
		expect(ledger.byTaskId(fr)).toBeNull();

		clock.advance(1);
		expect(await expectJson(await claim(app, fr, linguist), 409)).toEqual({
			error: "claim_closed",
		});
		await worker.tick();
		expect(await expectJson(await claim(app, fr, linguist), 409)).toEqual({
			error: "claim_closed",
		});

		expect(taskById(database, fr)?.state).toBe("expired_unclaimed");
		expect(ledger.byTaskId(fr)).toMatchObject({
			kind: PayoutKind.Refund,
			memo: `hr:${fr}:unclaimed`,
			legs: [
				{ role: LegRole.Refund, wallet: WALLETS.firm.address, units: 500_000n },
			],
		});
		expect(ledger.byTaskId(es)).toBeNull();
		expect(gateway.logs).toContain(
			`[payouts] decided refund hr:${fr}:unclaimed`,
		);
	});

	test("expiry refunds are recorded even while the preflight fails", async () => {
		const gateway = createTestGateway();
		const { app, database, clock, worker } = gateway;
		const { firm, linguist } = await people(app);
		const { es, fr } = await paidOrder(gateway, firm.mcpToken, "po-16");
		await expectJson(await claim(app, es, linguist), 200);
		gateway.problems.push("hold wallet needs at least 0.05 SOL for fees");

		clock.advance(WORK_MS);
		await worker.tick();

		const ledger = taskLedger(database);
		expect(ledger.byTaskId(fr)).toMatchObject({
			memo: `hr:${fr}:unclaimed`,
			status: TransferStatus.Pending,
		});
		expect(ledger.byTaskId(es)).toMatchObject({
			memo: `hr:${es}:late`,
			status: TransferStatus.Pending,
		});
		expect(signing(gateway)).toEqual([]);
	});

	describe("publicState stays paying_out or refunding until the transfer is confirmed", () => {
		const decided = async () => {
			const gateway = createTestGateway();
			const { app, clock, worker } = gateway;
			const { firm, linguist } = await people(app);
			const first = await paidOrder(gateway, firm.mcpToken, "po-17-a");
			const second = await paidOrder(gateway, firm.mcpToken, "po-17-b");
			await submitted(app, first.es, linguist);
			await submitted(app, first.fr, linguist);
			await expectJson(
				await post(app, `/api/tasks/${first.es}/approve`, firm.cookie),
				200,
			);
			const reason = { reason: "Wrong terms" };
			await expectJson(
				await post(app, `/api/tasks/${first.fr}/reject`, firm.cookie, reason),
				200,
			);
			await expectJson(await claim(app, second.es, linguist), 200);
			// Paused: the worker records the expiry refunds but leaves every row as the test sets it.
			gateway.problems.push("rpc check failed");
			clock.advance(WORK_MS);
			await worker.tick();
			const tasks = {
				approved: first.es,
				rejected: first.fr,
				expired_late: second.es,
				expired_unclaimed: second.fr,
			};
			return { gateway, firm, tasks };
		};

		const rows = ["null", "pending", "sent", "failed", "confirmed"];
		test.each(rows)("transfer %s", async (status) => {
			const { gateway, firm, tasks } = await decided();
			for (const [state, taskId] of Object.entries(tasks)) {
				const { database } = gateway;
				if (status === "null") {
					database
						.prepare("DELETE FROM transfers WHERE task_id = ?")
						.run(taskId);
				} else {
					database
						.prepare("UPDATE transfers SET status = ? WHERE task_id = ?")
						.run(status, taskId);
				}
				const view = await expectJson(
					await send(gateway.app, "GET", `/api/tasks/${taskId}`, {
						bearer: firm.mcpToken,
					}),
					200,
				);
				const paid = state === "approved";
				const done = status === "confirmed";
				const expected = paid
					? done
						? "paid_out"
						: "paying_out"
					: done
						? "refunded"
						: "refunding";
				expect([view.state, view.publicState]).toEqual([state, expected]);
			}
		});
	});
});
