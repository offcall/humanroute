// Order money path on real processes: payment and replay,
// payout split, timer refund (flow.md row 25). Every case builds its own fixture.
import { describe, expect, test } from "vitest";
import { ataExists, txFacts, usdcOf } from "./support/chain.js";
import { e2eEnv } from "./support/env.js";
import { FirmSlot } from "./support/firms.js";
import { firmAt, paidOrder, team } from "./support/fixture.js";
import { text } from "./support/http.js";
import { createDraft, postPayment, signedHeader } from "./support/orders.js";
import {
	approve,
	claim,
	orderTasks,
	submit,
	waitConfirmed,
} from "./support/tasks.js";

const PRICE = 500_000n;
const ATA_PROGRAM = "spl-associated-token-account";

describe("order flow", () => {
	test("three roles register, one x402 payment pays a draft for es, fr and de, and a replay or second payment charges nothing", async () => {
		const env = e2eEnv();
		const firm = await firmAt(FirmSlot.OrderPaid);
		await team();
		const wallet = firm.key.publicKey.toBase58();
		const firmBefore = await usdcOf(wallet);
		const draft = await createDraft(firm.mcpToken, ["es", "fr", "de"]);
		const header = await signedHeader(firm.key, draft);
		// Signed before the first settles: a distinct payload for the same draft.
		const second = await signedHeader(firm.key, draft);

		const first = await postPayment(draft.draftId, header);

		expect(first.status).toBe(201);
		expect(draft.totalUnits).toBe(1_500_000n);
		const facts = await txFacts(text(first.body, "payTx"));
		expect(facts.deltas.get(env.holdAddress)).toBe(1_500_000n);
		expect(facts.deltas.get(wallet)).toBe(-1_500_000n);
		expect(await usdcOf(wallet)).toBe(firmBefore - 1_500_000n);
		const tasks = await orderTasks(firm.jar, text(first.body, "orderId"));
		expect(tasks.map((task) => task.targetLang).sort()).toEqual([
			"de",
			"es",
			"fr",
		]);
		expect(tasks.every((task) => task.state === "open")).toBe(true);

		const replay = await postPayment(draft.draftId, header);
		expect(replay.status).toBe(201);
		expect(replay.body).toEqual(first.body);
		const other = await postPayment(draft.draftId, second);
		expect(other.status).toBe(409);
		expect(other.body.error).toBe("draft_paid");
		expect(await usdcOf(wallet)).toBe(firmBefore - 1_500_000n);
	});

	test("approving a claimed and submitted task sends one transaction with the split and creates missing ATAs", async () => {
		const env = e2eEnv();
		const firm = await firmAt(FirmSlot.OrderDecisions);
		const { agency, linguist } = await team();
		const linguistWallet = linguist.key.publicKey.toBase58();
		const agencyWallet = agency.key.publicKey.toBase58();
		expect(await ataExists(linguistWallet)).toBe(false);
		expect(await ataExists(agencyWallet)).toBe(false);
		const order = await paidOrder(firm, ["es"]);
		const taskId = order.task("es").taskId;

		await claim(linguist.jar, taskId);
		await submit(linguist.jar, taskId);
		await approve(firm.jar, taskId);
		const done = await waitConfirmed(firm.jar, order.paid.orderId, taskId);

		expect(done.publicState).toBe("paid_out");
		expect(done.memo).toBe(`hr:${taskId}`);
		const facts = await txFacts(done.transferTx ?? "");
		expect(facts.deltas.get(linguistWallet)).toBe(400_000n);
		expect(facts.deltas.get(agencyWallet)).toBe(90_000n);
		expect(facts.deltas.get(env.feeWallet)).toBe(10_000n);
		expect(facts.deltas.get(env.holdAddress)).toBe(-PRICE);
		expect(facts.memos).toContain(`hr:${taskId}`);
		expect(
			facts.programs.filter((name) => name === ATA_PROGRAM).length,
		).toBeGreaterThanOrEqual(2);
		expect(await ataExists(linguistWallet)).toBe(true);
		expect(await ataExists(agencyWallet)).toBe(true);
	});

	test("an unclaimed task is refunded as :unclaimed after its claim window", async () => {
		const firm = await firmAt(FirmSlot.OrderExpiry);
		const order = await paidOrder(firm, ["de"]);
		const task = order.task("de");
		const wait =
			Math.max(0, Date.parse(task.claimDeadline) - Date.now()) + 60_000;

		const done = await waitConfirmed(
			firm.jar,
			order.paid.orderId,
			task.taskId,
			wait,
		);

		expect(done.state).toBe("expired_unclaimed");
		expect(done.publicState).toBe("refunded");
		expect(done.memo).toBe(`hr:${task.taskId}:unclaimed`);
		const facts = await txFacts(done.transferTx ?? "");
		expect(facts.deltas.get(firm.key.publicKey.toBase58())).toBe(PRICE);
		expect(facts.memos).toContain(`hr:${task.taskId}:unclaimed`);
	});
});
