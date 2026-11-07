// Order money path on real processes (reproduces scripts/e2e-flow.ts): payment, payout split,
// rejection refund, payment replay. Every case builds its own fixture.
import { describe, expect, it } from "vitest";
import { ataExists, txFacts, usdcOf } from "./support/chain.js";
import { e2eEnv } from "./support/env.js";
import { FirmSlot } from "./support/firms.js";
import { firmAt, paidOrder, team } from "./support/fixture.js";
import { createDraft, postPayment, signedHeader } from "./support/orders.js";
import {
	approve,
	claim,
	reject,
	submit,
	waitConfirmed,
} from "./support/tasks.js";

const PRICE = 500_000n;
const ATA_PROGRAM = "spl-associated-token-account";

describe("order flow", () => {
	it("EE-11 three roles register and a draft for es, fr and de is paid with one x402 payment", async () => {
		const env = e2eEnv();
		const firm = await firmAt(FirmSlot.OrderPaid);
		await team();
		const wallet = firm.key.publicKey.toBase58();
		const firmBefore = await usdcOf(wallet);

		const order = await paidOrder(firm, ["es", "fr", "de"]);

		expect(order.draft.totalUnits).toBe(1_500_000n);
		const facts = await txFacts(order.paid.payTx);
		expect(facts.deltas.get(env.holdAddress)).toBe(1_500_000n);
		expect(facts.deltas.get(wallet)).toBe(-1_500_000n);
		expect(await usdcOf(wallet)).toBe(firmBefore - 1_500_000n);
		expect(order.tasks.map((task) => task.targetLang).sort()).toEqual([
			"de",
			"es",
			"fr",
		]);
		expect(order.tasks.every((task) => task.state === "open")).toBe(true);
	});

	it("EE-13 approving a claimed and submitted task sends one transaction with the split and creates missing ATAs", async () => {
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

	it("EE-14 rejecting refunds 0.50 to the firm wallet with memo :rejected", async () => {
		const firm = await firmAt(FirmSlot.OrderDecisions);
		const { linguist } = await team();
		const order = await paidOrder(firm, ["fr"]);
		const taskId = order.task("fr").taskId;

		await claim(linguist.jar, taskId);
		await submit(linguist.jar, taskId);
		await reject(firm.jar, taskId, "e2e: rejected on purpose");
		const done = await waitConfirmed(firm.jar, order.paid.orderId, taskId);

		expect(done.publicState).toBe("refunded");
		expect(done.memo).toBe(`hr:${taskId}:rejected`);
		const facts = await txFacts(done.transferTx ?? "");
		expect(facts.deltas.get(firm.key.publicKey.toBase58())).toBe(PRICE);
		expect(facts.memos).toContain(`hr:${taskId}:rejected`);
	});

	it("EE-18 the same payment again returns the same order and a second payment for the paid draft is refused without a charge", async () => {
		const firm = await firmAt(FirmSlot.OrderReplay);
		const wallet = firm.key.publicKey.toBase58();
		const draft = await createDraft(firm.mcpToken, ["es", "de"]);
		const header = await signedHeader(firm.key, draft);
		// Signed before the first settles: a distinct payload for the same draft.
		const second = await signedHeader(firm.key, draft);

		const first = await postPayment(draft.draftId, header);
		expect(first.status).toBe(201);
		// The hold balance also moves with other cases' payouts; the firm's is isolated.
		const settled = await usdcOf(wallet);

		const replay = await postPayment(draft.draftId, header);
		expect(replay.status).toBe(201);
		expect(replay.body).toEqual(first.body);

		const other = await postPayment(draft.draftId, second);
		expect(other.status).toBe(409);
		expect(other.body.error).toBe("draft_paid");
		expect(await usdcOf(wallet)).toBe(settled);
		expect(first.body.payTx).toBe(replay.body.payTx);
	});
});
