import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
import { TransferStatus } from "../store/index.js";
import { taskById } from "../tasks/index.js";
import {
	claim,
	expectJson,
	paidOrder,
	payOrder,
	send,
	submitted,
	type TestGateway,
	WALLETS,
} from "../testing/index.js";
import { taskLedger } from "./ledger.js";
import { LegRole, PayoutKind } from "./taskTypes.js";

const CLAIM_MS = 60_000;
const WORK_MS = 180_000;

const post = (app: Hono, path: string, cookie: string, body: unknown = {}) =>
	send(app, "POST", path, { cookie, body });

const signing = (gateway: TestGateway) =>
	gateway.chain.calls.filter(
		(call) => call.method === "signPayout" || call.method === "broadcast",
	);

describe("payout decisions", () => {
	test("approving writes one pending payout to the wallets snapshotted at claim and FEE_WALLET with memo hr:<taskId>", async () => {
		const gateway = await paidOrder({ memo: "po-10" });
		const { app, database, firm, es } = gateway;
		await submitted(gateway, [es]);

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
		const gateway = await paidOrder({ memo: "po-11" });
		const { app, database, firm, es } = gateway;
		await submitted(gateway, [es]);

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
		const gateway = await paidOrder({ memo: "po-13" });
		const { app, database, firm, es } = gateway;
		await submitted(gateway, [es]);
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
		const gateway = await paidOrder({ memo: "po-14" });
		const { database, clock, worker, es, fr } = gateway;
		const ledger = taskLedger(database);

		clock.advance(CLAIM_MS - 1);
		await expectJson(await claim(gateway, es), 200);
		await worker.tick();
		expect(ledger.byTaskId(fr)).toBeNull();

		clock.advance(1);
		expect(await expectJson(await claim(gateway, fr), 409)).toEqual({
			error: "claim_closed",
		});
		await worker.tick();
		expect(await expectJson(await claim(gateway, fr), 409)).toEqual({
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
		const gateway = await paidOrder({ memo: "po-16" });
		const { database, clock, worker, es, fr } = gateway;
		await expectJson(await claim(gateway, es), 200);
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
			const gateway = await paidOrder({ memo: "po-17-a" });
			const { app, clock, worker, firm } = gateway;
			const first = gateway;
			const second = await payOrder(gateway, firm, "po-17-b");
			await submitted(gateway, [first.es]);
			await submitted(gateway, [first.fr]);
			await expectJson(
				await post(app, `/api/tasks/${first.es}/approve`, firm.cookie),
				200,
			);
			const reason = { reason: "Wrong terms" };
			await expectJson(
				await post(app, `/api/tasks/${first.fr}/reject`, firm.cookie, reason),
				200,
			);
			await expectJson(await claim(gateway, second.es), 200);
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
