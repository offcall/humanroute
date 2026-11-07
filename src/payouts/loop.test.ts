import { afterEach, describe, expect, test, vi } from "vitest";
import { TransferStatus } from "../store/index.js";
import { createTestGateway, seedTransfer } from "../testing/index.js";

// A gateway with a pending row "pending-1" and a sent row "sent-1".
const setup = () => {
	const gateway = createTestGateway();
	const pending = { id: "pending-1", taskId: "task-pending-1" };
	const { ledger } = seedTransfer(gateway, pending);
	const sent = { id: "sent-1", taskId: "task-sent-1" };
	seedTransfer(gateway, { ...sent, status: TransferStatus.Sent });
	const statusOf = (id: string) => ledger.find(id)?.status;
	const lines = (text: string) =>
		gateway.logs.filter((line) => line === `[payouts] ${text}`);

	return { ...gateway, ledger, statusOf, lines };
};

afterEach(() => {
	vi.useRealTimers();
});

describe("payouts loop and preflight", () => {
	test("sends nothing and counts no attempt while the preflight fails", async () => {
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

	test("logs payouts paused and resumed once per transition and resumes sending", async () => {
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
