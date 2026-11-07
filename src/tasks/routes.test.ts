// Board, claim, GET /api/tasks/:id and the linguist cabinet (api.md, ADR 0023, ADR 0033).
import { describe, expect, test } from "vitest";
import {
	claim,
	expectJson,
	joinLinguist,
	listField,
	objectField,
	paidOrder,
	payOrder,
	registerAgency,
	registerFirm,
	send,
	type TestGateway,
	testWallet,
	textField,
	WALLETS,
} from "../testing/index.js";

const EN_ES = [{ source: "en", target: "es" }];
const CLAIM_WINDOW_MS = 60_000;

// A firm, an agency with one en→es linguist, and one paid order: an es and an fr task.
const scene = () => paidOrder({ pairs: EN_ES });

const getTask = (
	gateway: TestGateway,
	taskId: string,
	auth: { cookie?: string; bearer?: string },
) => send(gateway.app, "GET", `/api/tasks/${taskId}`, auth);

const boardIds = async (gateway: TestGateway, cookie: string) =>
	listField(
		await expectJson(
			await send(gateway.app, "GET", "/api/board", { cookie }),
			200,
		),
		"tasks",
	).map((item) => textField(item, "taskId"));

describe("board and claim", () => {
	test("the board shows only open tasks in the linguist's pairs, soonest claim deadline first, with the firm name", async () => {
		const gateway = await scene();
		gateway.clock.advance(1_000);
		const later = await payOrder(gateway, gateway.firm, "order-2");
		const other = await joinLinguist(
			gateway.app,
			testWallet(21),
			gateway.agency.inviteCode,
			EN_ES,
		);
		await expectJson(await claim(gateway, later.es, other), 200);
		gateway.clock.advance(1_000);
		const latest = await payOrder(gateway, gateway.firm, "order-3");

		const res = await send(gateway.app, "GET", "/api/board", {
			cookie: gateway.linguist,
		});
		const items = listField(await expectJson(res, 200), "tasks");
		expect(items.map((item) => item.taskId)).toEqual([gateway.es, latest.es]);
		expect(items[0]).toMatchObject({
			firmName: "MedSafe-Rx",
			sourceLang: "en",
			targetLang: "es",
			priceUnits: "500000",
		});
	});

	test("the board hides a task at its claim deadline", async () => {
		const gateway = await scene();
		gateway.clock.advance(CLAIM_WINDOW_MS - 1);
		expect(await boardIds(gateway, gateway.linguist)).toEqual([gateway.es]);

		gateway.clock.advance(1);
		expect(await boardIds(gateway, gateway.linguist)).toEqual([]);
	});

	test("board, claim and submit are for linguists only", async () => {
		const gateway = await scene();
		const calls = [
			["GET", "/api/board"],
			["POST", `/api/tasks/${gateway.es}/claim`],
			["POST", `/api/tasks/${gateway.es}/submit`],
		];
		for (const [method, path] of calls) {
			const body = method === "POST" ? { result: "x" } : undefined;
			const anonymous = await send(gateway.app, method ?? "", path ?? "", {
				body,
			});
			expect(anonymous.status).toBe(401);
			for (const cookie of [gateway.firm.cookie, gateway.agency.cookie]) {
				const res = await send(gateway.app, method ?? "", path ?? "", {
					cookie,
					body,
				});
				expect(res.status).toBe(403);
			}
		}
	});

	test("the first claim wins and a second linguist gets 409 claim_taken", async () => {
		const gateway = await scene();
		const rival = testWallet(22);
		const second = await joinLinguist(
			gateway.app,
			rival,
			gateway.agency.inviteCode,
			EN_ES,
		);

		const answers = await Promise.all([
			claim(gateway, gateway.es, gateway.linguist),
			claim(gateway, gateway.es, second),
		]);
		const statuses = answers.map((res) => res.status).sort();
		expect(statuses).toEqual([200, 409]);
		const lost = answers.find((res) => res.status === 409);
		expect(await lost?.json()).toEqual({ error: "claim_taken" });

		const rows = gateway.database
			.prepare("SELECT linguist_wallet, work_deadline FROM tasks WHERE id = ?")
			.all(gateway.es);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			linguist_wallet: WALLETS.linguist.address,
			work_deadline: gateway.clock.now() + 180_000,
		});
	});

	test("a claim outside the linguist's pairs answers 404", async () => {
		const gateway = await scene();
		const res = await claim(gateway, gateway.fr, gateway.linguist);
		expect(await expectJson(res, 404)).toEqual({ error: "not_found" });
	});

	test("an unknown task id answers 404 on GET, claim, submit, approve and reject", async () => {
		const gateway = await scene();
		const unknown = "00000000-0000-4000-8000-999999999999";
		const { app, firm, linguist } = gateway;
		const answers = [
			await getTask(gateway, unknown, { cookie: firm.cookie }),
			await claim(gateway, unknown, linguist),
			await send(app, "POST", `/api/tasks/${unknown}/submit`, {
				cookie: linguist,
				body: { result: "Hola" },
			}),
			await send(app, "POST", `/api/tasks/${unknown}/approve`, {
				cookie: firm.cookie,
				body: {},
			}),
			await send(app, "POST", `/api/tasks/${unknown}/reject`, {
				cookie: firm.cookie,
				body: { reason: "wrong" },
			}),
		];
		expect(answers.map((res) => res.status)).toEqual([404, 404, 404, 404, 404]);
	});
});

describe("task visibility", () => {
	test("a task is visible to the owner firm, the claimer and the claimer's agency; others 403; no credentials 401", async () => {
		const gateway = await scene();
		await expectJson(await claim(gateway, gateway.es, gateway.linguist), 200);
		const otherFirm = await registerFirm(gateway.app, testWallet(23));
		const otherAgency = await registerAgency(gateway.app, testWallet(24));
		const otherLinguist = await joinLinguist(
			gateway.app,
			testWallet(25),
			gateway.agency.inviteCode,
			EN_ES,
		);

		const status = async (cookie?: string) =>
			(
				await getTask(
					gateway,
					gateway.es,
					cookie === undefined ? {} : { cookie },
				)
			).status;
		expect(await status(gateway.firm.cookie)).toBe(200);
		expect(await status(gateway.linguist)).toBe(200);
		expect(await status(gateway.agency.cookie)).toBe(200);
		expect(await status(otherFirm.cookie)).toBe(403);
		expect(await status(otherAgency.cookie)).toBe(403);
		expect(await status(otherLinguist)).toBe(403);
		expect(await status()).toBe(401);
	});

	test("the owner firm's MCP token reads the task; another firm's token 403; an unknown token 401", async () => {
		const gateway = await scene();
		const otherFirm = await registerFirm(gateway.app, testWallet(26));
		const status = async (bearer: string) =>
			(await getTask(gateway, gateway.es, { bearer })).status;

		expect(await status(gateway.firm.mcpToken)).toBe(200);
		expect(await status(otherFirm.mcpToken)).toBe(403);
		expect(await status("not-a-known-token")).toBe(401);
	});
});

describe("task views", () => {
	test("executorPairs is filled only for the owner firm after a claim", async () => {
		const gateway = await scene();
		const open = await expectJson(
			await getTask(gateway, gateway.es, { cookie: gateway.firm.cookie }),
			200,
		);
		expect(open.executorPairs).toBeNull();

		const claimed = await expectJson(
			await claim(gateway, gateway.es, gateway.linguist),
			200,
		);
		expect(claimed).not.toHaveProperty("executorPairs");
		const owner = await getTask(gateway, gateway.es, {
			bearer: gateway.firm.mcpToken,
		});
		expect((await expectJson(owner, 200)).executorPairs).toEqual(EN_ES);
		for (const cookie of [gateway.linguist, gateway.agency.cookie]) {
			const view = await expectJson(
				await getTask(gateway, gateway.es, { cookie }),
				200,
			);
			expect(view.executorPairs).toBeNull();
		}

		const submitted = await expectJson(
			await send(gateway.app, "POST", `/api/tasks/${gateway.es}/submit`, {
				cookie: gateway.linguist,
				body: { result: "Hola" },
			}),
			200,
		);
		expect(submitted).not.toHaveProperty("executorPairs");
		const board = await expectJson(
			await send(gateway.app, "GET", "/api/board", {
				cookie: gateway.linguist,
			}),
			200,
		);
		expect(board.tasks).toEqual([]);
	});

	test("earnedUnits is a string only for the claimer of a payout", async () => {
		const gateway = await scene();
		const { config } = gateway;
		const agency = (500_000n * config.agencyShareBps) / 10_000n;
		const fee = (500_000n * config.feeShareBps) / 10_000n;
		const share = (500_000n - agency - fee).toString();
		const earned = async (
			taskId: string,
			auth: { cookie?: string; bearer?: string },
		) =>
			objectField(
				await expectJson(await getTask(gateway, taskId, auth), 200),
				"transfer",
			).earnedUnits;

		const otherLinguist = await joinLinguist(
			gateway.app,
			testWallet(27),
			gateway.agency.inviteCode,
			[{ source: "en", target: "fr" }],
		);
		const claimers: [string, string][] = [
			[gateway.es, gateway.linguist],
			[gateway.fr, otherLinguist],
		];
		for (const [taskId, cookie] of claimers) {
			await expectJson(await claim(gateway, taskId, cookie), 200);
			await send(gateway.app, "POST", `/api/tasks/${taskId}/submit`, {
				cookie,
				body: { result: "done" },
			});
		}
		await send(gateway.app, "POST", `/api/tasks/${gateway.es}/approve`, {
			bearer: gateway.firm.mcpToken,
		});
		await send(gateway.app, "POST", `/api/tasks/${gateway.fr}/reject`, {
			bearer: gateway.firm.mcpToken,
			body: { reason: "wrong terms" },
		});

		expect(await earned(gateway.es, { cookie: gateway.linguist })).toBe(share);
		expect(
			await earned(gateway.es, { cookie: gateway.agency.cookie }),
		).toBeNull();
		expect(
			await earned(gateway.es, { bearer: gateway.firm.mcpToken }),
		).toBeNull();
		expect(await earned(gateway.fr, { cookie: otherLinguist })).toBeNull();
	});

	test("translatorNo is the 1-based join order inside the agency", async () => {
		const gateway = await scene();
		const second = await joinLinguist(
			gateway.app,
			testWallet(28),
			gateway.agency.inviteCode,
			EN_ES,
		);
		const translatorNo = async (cookie: string) =>
			(
				await expectJson(
					await send(gateway.app, "GET", "/api/linguist", { cookie }),
					200,
				)
			).translatorNo;

		expect(await translatorNo(gateway.linguist)).toBe(1);
		expect(await translatorNo(second)).toBe(2);
		await expectJson(await claim(gateway, gateway.es, second), 200);
		const view = await expectJson(
			await getTask(gateway, gateway.es, { cookie: gateway.firm.cookie }),
			200,
		);
		expect(view.translatorNo).toBe(2);
	});

	test("the linguist cabinet shows pairs and own tasks, for linguists only", async () => {
		const gateway = await scene();
		const cabinet = () =>
			send(gateway.app, "GET", "/api/linguist", { cookie: gateway.linguist });
		const before = await expectJson(await cabinet(), 200);
		expect(before).toMatchObject({ pairs: EN_ES, earnedUnits: "0", tasks: [] });

		await expectJson(await claim(gateway, gateway.es), 200);
		const claimed = await expectJson(await cabinet(), 200);
		expect(listField(claimed, "tasks").map((task) => task.taskId)).toEqual([
			gateway.es,
		]);

		const firmView = await send(gateway.app, "GET", "/api/linguist", {
			cookie: gateway.firm.cookie,
		});
		expect(firmView.status).toBe(404);
		expect((await send(gateway.app, "GET", "/api/linguist")).status).toBe(401);
	});
});
