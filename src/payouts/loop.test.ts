import { afterEach, describe, expect, it, vi } from "vitest";
import { TransferStatus } from "../store/index.js";
import {
	createTestGateway,
	FAKE_BLOCKHASH,
	WALLETS,
} from "../testing/index.js";
import { taskLedger } from "./ledger.js";
import { LegRole, PayoutKind } from "./taskTypes.js";

// A gateway with a pending row "pending-1" and a sent row "sent-1".
const setup = () => {
	const gateway = createTestGateway();
	const ledger = taskLedger(gateway.database);
	const now = gateway.clock.now();
	for (const id of ["pending-1", "sent-1"]) {
		ledger.insert(
			{
				id,
				taskId: `task-${id}`,
				kind: PayoutKind.Payout,
				legs: [
					{
						role: LegRole.Linguist,
						wallet: WALLETS.linguist.address,
						units: 1n,
					},
				],
				memo: `hr:task-${id}`,
			},
			now,
		);
	}
	const sent = {
		txSig: "old-sig",
		blockhash: FAKE_BLOCKHASH,
		lastValidBlockHeight: 1000,
	};
	ledger.markSent("sent-1", sent, now);
	const statusOf = (id: string) => ledger.find(id)?.status;
	const lines = (text: string) =>
		gateway.logs.filter((line) => line === `[payouts] ${text}`);

	return { ...gateway, ledger, statusOf, lines };
};

afterEach(() => {
	vi.useRealTimers();
});

describe("payouts loop and preflight", () => {
	it("PO-50 sends nothing and counts no attempt while the preflight fails", async () => {
		vi.useFakeTimers();
		const gateway = setup();
		gateway.problems.push("hold wallet needs at least 0.05 SOL for fees");

		await gateway.worker.start();
		gateway.worker.stop();
		for (let tick = 0; tick < 3; tick += 1) {
			gateway.clock.advance(60_000);
			await gateway.worker.tick();
		}

		expect(gateway.chain.calls).toEqual([]);
		expect(gateway.ledger.find("pending-1")).toMatchObject({
			status: TransferStatus.Pending,
			attempts: 0,
		});
		expect(gateway.ledger.find("sent-1")).toMatchObject({
			status: TransferStatus.Sent,
			attempts: 0,
		});
	});

	it("PO-51 logs payouts paused and resumed once per transition and resumes sending", async () => {
		const gateway = setup();
		gateway.problems.push("rpc check failed");

		await gateway.worker.tick();
		await gateway.worker.tick();
		expect(gateway.chain.calls).toEqual([]);

		gateway.problems.length = 0;
		await gateway.worker.tick();
		await gateway.worker.tick();

		expect(gateway.lines("payouts paused: preflight failing")).toHaveLength(1);
		expect(gateway.lines("payouts resumed")).toHaveLength(1);
		const signed = gateway.chain.calls.filter(
			(call) => call.method === "signPayout",
		);
		expect(signed).toHaveLength(1);
		expect(gateway.statusOf("pending-1")).toBe(TransferStatus.Confirmed);
		expect(gateway.statusOf("sent-1")).toBe(TransferStatus.Confirmed);
	});
});
