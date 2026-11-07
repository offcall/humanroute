import type { Hono } from "hono";
import { describe, expect, test } from "vitest";
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
	type TestWallet,
	testWallet,
	textField,
	WALLETS,
} from "../testing/index.js";
import { moneyByAgency, moneyByFirm } from "./totals.js";

const PAIRS = [
	{ source: "en", target: "es" },
	{ source: "en", target: "fr" },
];

const post = (app: Hono, path: string, cookie: string, body: unknown = {}) =>
	send(app, "POST", path, { cookie, body });

const paidOrder = async (
	gateway: TestGateway,
	mcpToken: string,
	payer: TestWallet,
	memo: string,
) => {
	const { app, database } = gateway;
	const draftId = textField(await createDraft(app, mcpToken), "draftId");
	const header = await paymentFor(app, draftId, payer, memo);
	const paid = await expectJson(await payDraft(app, draftId, header), 201);
	const ids = Array.isArray(paid.taskIds) ? paid.taskIds : [];
	const lang = (target: string) => {
		const id = ids.find(
			(item) =>
				typeof item === "string" &&
				taskById(database, item)?.targetLang === target,
		);
		if (typeof id !== "string") {
			throw new Error(`no ${target} task`);
		}
		return id;
	};
	return { es: lang("es"), fr: lang("fr") };
};

const work = async (app: Hono, taskId: string, linguist: string) => {
	await expectJson(
		await post(app, `/api/tasks/${taskId}/claim`, linguist),
		200,
	);
	const body = { result: "Hecho." };
	await expectJson(
		await post(app, `/api/tasks/${taskId}/submit`, linguist, body),
		200,
	);
};

const approve = async (
	app: Hono,
	taskId: string,
	linguist: string,
	firm: string,
) => {
	await work(app, taskId, linguist);
	await expectJson(await post(app, `/api/tasks/${taskId}/approve`, firm), 200);
};

describe("payout totals", () => {
	test("role totals count only confirmed transfers and the right legs", async () => {
		const gateway = createTestGateway();
		const { app, database } = gateway;
		const firmB = testWallet(11);
		const firmA = await registerFirm(app, WALLETS.firm);
		const otherFirm = await registerFirm(app, firmB);
		const agency1 = await registerAgency(app, WALLETS.agency);
		const agency2 = await registerAgency(app, testWallet(12));
		const l1 = await joinLinguist(
			app,
			WALLETS.linguist,
			agency1.inviteCode,
			PAIRS,
		);
		const l2 = await joinLinguist(
			app,
			testWallet(13),
			agency2.inviteCode,
			PAIRS,
		);

		const kept = await paidOrder(gateway, firmA.mcpToken, WALLETS.firm, "a-1");
		const distract = await paidOrder(
			gateway,
			firmA.mcpToken,
			WALLETS.firm,
			"a-2",
		);
		const failed = await paidOrder(
			gateway,
			firmA.mcpToken,
			WALLETS.firm,
			"a-3",
		);
		const other = await paidOrder(gateway, otherFirm.mcpToken, firmB, "b-1");

		await approve(app, kept.es, l1, firmA.cookie);
		await work(app, kept.fr, l1);
		const reason = { reason: "Wrong terms" };
		await expectJson(
			await post(app, `/api/tasks/${kept.fr}/reject`, firmA.cookie, reason),
			200,
		);
		await approve(app, distract.es, l1, firmA.cookie);
		await approve(app, distract.fr, l2, firmA.cookie);
		await approve(app, failed.es, l1, firmA.cookie);
		await approve(app, other.es, l2, otherFirm.cookie);
		await approve(app, other.fr, l1, otherFirm.cookie);
		await gateway.worker.tick();

		const setStatus = (taskId: string, status: string) =>
			database
				.prepare("UPDATE transfers SET status = ? WHERE task_id = ?")
				.run(status, taskId);
		setStatus(distract.es, "pending");
		setStatus(distract.fr, "sent");
		setStatus(failed.es, "failed");

		const cabinet = await expectJson(
			await send(app, "GET", "/api/linguist", { cookie: l1 }),
			200,
		);
		expect(cabinet.earnedUnits).toBe("800000");
		expect(moneyByAgency(database, agency1.agencyId)).toEqual({
			paidUnits: 180_000n,
		});
		expect(moneyByAgency(database, agency2.agencyId)).toEqual({
			paidUnits: 90_000n,
		});
		expect(moneyByFirm(database, firmA.firmId)).toEqual({
			spentUnits: 500_000n,
			refundedUnits: 500_000n,
		});
		expect(moneyByFirm(database, otherFirm.firmId)).toEqual({
			spentUnits: 1_000_000n,
			refundedUnits: 0n,
		});
	});
});
