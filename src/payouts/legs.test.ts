import { describe, expect, it } from "vitest";
import { type Task, TaskState } from "../tasks/index.js";
import { WALLETS } from "../testing/index.js";
import { memoFor, refundLegs, splitLegs } from "./legs.js";
import { LegRole, type Shares } from "./taskTypes.js";

const SHARES: Shares = {
	agencyBps: 1800n,
	feeBps: 200n,
	feeWallet: WALLETS.fee.address,
};

const task = (priceUnits: bigint, payees = true): Task => ({
	id: "task-1",
	orderId: "order-1",
	firmId: "firm-1",
	sourceLang: "en",
	targetLang: "es",
	text: "text",
	draft: "draft",
	result: null,
	reason: null,
	state: TaskState.Submitted,
	priceUnits,
	refundWallet: WALLETS.firm.address,
	linguistId: payees ? "linguist-1" : null,
	linguistWallet: payees ? WALLETS.linguist.address : null,
	agencyId: payees ? "agency-1" : null,
	agencyWallet: payees ? WALLETS.agency.address : null,
	claimDeadline: 0,
	workDeadline: null,
	createdAt: 0,
	updatedAt: 0,
});

const unitsByRole = (priceUnits: bigint) =>
	Object.fromEntries(
		splitLegs(task(priceUnits), SHARES).map((leg) => [leg.role, leg.units]),
	);

describe("payout legs", () => {
	it("PO-01 splits 0.50 USDC into 400000 / 90000 / 10000 for linguist, agency and fee", () => {
		expect(splitLegs(task(500_000n), SHARES)).toEqual([
			{
				role: LegRole.Linguist,
				wallet: WALLETS.linguist.address,
				units: 400_000n,
			},
			{ role: LegRole.Agency, wallet: WALLETS.agency.address, units: 90_000n },
			{ role: LegRole.Fee, wallet: WALLETS.fee.address, units: 10_000n },
		]);
	});

	it("PO-02 keeps the sum equal to the price and gives the rounding remainder to the linguist", () => {
		const prices = [
			...Array.from({ length: 20_000 }, (_, index) => BigInt(index + 1)),
			333_333n,
			999_999n,
			1_234_567n,
		];
		for (const price of prices) {
			const legs = splitLegs(task(price), SHARES);
			const byRole = new Map(legs.map((leg) => [leg.role, leg.units]));
			const agency = byRole.get(LegRole.Agency) ?? 0n;
			const fee = byRole.get(LegRole.Fee) ?? 0n;
			const linguist = byRole.get(LegRole.Linguist) ?? 0n;

			// Oracle: each bps share is the largest whole unit not above its exact share.
			expect(agency * 10_000n <= price * 1800n).toBe(true);
			expect((agency + 1n) * 10_000n > price * 1800n).toBe(true);
			expect(fee * 10_000n <= price * 200n).toBe(true);
			expect((fee + 1n) * 10_000n > price * 200n).toBe(true);
			expect(linguist + agency + fee).toBe(price);
			expect(linguist * 10_000n >= price * 8000n).toBe(true);
			expect(legs.every((leg) => leg.units > 0n)).toBe(true);
		}
		expect(unitsByRole(1n)).toEqual({ [LegRole.Linguist]: 1n });
		expect(unitsByRole(333_333n)).toEqual({
			[LegRole.Linguist]: 266_668n,
			[LegRole.Agency]: 59_999n,
			[LegRole.Fee]: 6_666n,
		});
	});

	it("PO-04 throws when the task has no payee snapshot", () => {
		expect(() => splitLegs(task(500_000n, false), SHARES)).toThrow(
			"task task-1 has no payee snapshot",
		);
		const noAgency = { ...task(500_000n), agencyWallet: null };
		expect(() => splitLegs(noAgency, SHARES)).toThrow(/no payee snapshot/);
		const noLinguist = { ...task(500_000n), linguistWallet: null };
		expect(() => splitLegs(noLinguist, SHARES)).toThrow(/no payee snapshot/);
	});

	it("PO-05 refunds the full price to the task's refund wallet in one leg", () => {
		expect(refundLegs(task(1_234_567n))).toEqual([
			{ role: LegRole.Refund, wallet: WALLETS.firm.address, units: 1_234_567n },
		]);
	});

	it("PO-06 builds memos hr:<id>, :rejected, :unclaimed, :late and throws for open, claimed or submitted", () => {
		expect(memoFor("t1", TaskState.Approved)).toBe("hr:t1");
		expect(memoFor("t1", TaskState.Rejected)).toBe("hr:t1:rejected");
		expect(memoFor("t1", TaskState.ExpiredUnclaimed)).toBe("hr:t1:unclaimed");
		expect(memoFor("t1", TaskState.ExpiredLate)).toBe("hr:t1:late");
		for (const state of [
			TaskState.Open,
			TaskState.Claimed,
			TaskState.Submitted,
		]) {
			expect(() => memoFor("t1", state)).toThrow(
				`task t1 in state ${state} has no transfer`,
			);
		}
	});
});
