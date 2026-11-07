// Timer refunds on real processes (flow.md rows 20, 23) and the cabinets' money and ratings.
// Deadlines are read from the server; waits are bounded polls, never fixed sleeps.
import { describe, expect, test } from "vitest";
import { txFacts } from "./support/chain.js";
import { e2eEnv, pollUntil } from "./support/env.js";
import { FirmSlot } from "./support/firms.js";
import { firmAt, paidOrder, secondLinguist, team } from "./support/fixture.js";
import { call, text } from "./support/http.js";
import {
	approve,
	claim,
	reject,
	submit,
	waitConfirmed,
} from "./support/tasks.js";

const PRICE = 500_000n;
const SLACK_MS = 60_000;

const msUntil = (iso: string): number =>
	Math.max(0, Date.parse(iso) - Date.now());

describe("order timers and cabinets", () => {
	test("an unclaimed task is refunded as :unclaimed after its claim window", async () => {
		const firm = await firmAt(FirmSlot.OrderExpiry);
		const order = await paidOrder(firm, ["de"]);
		const task = order.task("de");
		const wait = msUntil(task.claimDeadline) + SLACK_MS;

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

	test("a claimed task not submitted in time is refunded as :late", async () => {
		const gateway = e2eEnv().gatewayUrl;
		const firm = await firmAt(FirmSlot.OrderExpiry);
		const { agency } = await team();
		const late = await secondLinguist(agency);
		const order = await paidOrder(firm, ["fr"]);
		const taskId = order.task("fr").taskId;

		const claimed = await claim(late.jar, taskId);
		const workDeadline = text(claimed, "workDeadline");
		await pollUntil(
			async () => Date.now(),
			(now) => now > Date.parse(workDeadline),
			msUntil(workDeadline) + SLACK_MS,
			"work window over",
		);
		const refused = await submit(late.jar, taskId, 409);
		expect(refused.error).toBe("late");
		const done = await waitConfirmed(
			firm.jar,
			order.paid.orderId,
			taskId,
			SLACK_MS,
		);

		expect(done.state).toBe("expired_late");
		expect(done.memo).toBe(`hr:${taskId}:late`);
		const facts = await txFacts(done.transferTx ?? "");
		expect(facts.deltas.get(firm.key.publicKey.toBase58())).toBe(PRICE);
		const rating = await call(
			gateway,
			"GET",
			`/api/rating/agency/${agency.agencyId}`,
		);
		expect(rating.late).toBe(1);
	});

	test("cabinets show confirmed money and ratings", async () => {
		const gateway = e2eEnv().gatewayUrl;
		const firm = await firmAt(FirmSlot.OrderRatings);
		const { agency, linguist } = await team();
		const order = await paidOrder(firm, ["es", "fr"]);
		const [es, fr] = [order.task("es").taskId, order.task("fr").taskId];
		for (const taskId of [es, fr]) {
			await claim(linguist.jar, taskId);
			await submit(linguist.jar, taskId);
		}
		await approve(firm.jar, es);
		await reject(firm.jar, fr, "e2e: rejected for the rating");
		await waitConfirmed(firm.jar, order.paid.orderId, es);
		await waitConfirmed(firm.jar, order.paid.orderId, fr);

		const agencyRating = await call(
			gateway,
			"GET",
			`/api/rating/agency/${agency.agencyId}`,
		);
		expect(agencyRating).toMatchObject({
			approved: 1,
			rejected: 1,
			late: 0,
			ratingPct: 50,
		});
		expect(agencyRating.paidUnits).toBe("90000");
		const firmRating = await call(
			gateway,
			"GET",
			`/api/rating/firm/${firm.firmId}`,
		);
		expect(firmRating).toMatchObject({
			approved: 1,
			rejected: 1,
			rejectPct: 50,
		});
		expect(firmRating.spentUnits).toBe(String(PRICE));
		expect(firmRating.refundedUnits).toBe(String(PRICE));
		const cabinet = await call(gateway, "GET", "/api/linguist", {
			jar: linguist.jar,
		});
		expect(cabinet.earnedUnits).toBe("400000");
	});
});
