import { describe, expect, it } from "vitest";
import { ErrorKind } from "../chain/index.js";
import { TransferStatus } from "../store/index.js";
import {
	chainFail,
	chainOk,
	createTestGateway,
	FAKE_BLOCKHASH,
	WALLETS,
} from "../testing/index.js";
import { taskLedger } from "./ledger.js";
import { fail, sendPending } from "./send.js";
import { LegRole, PayoutKind, type PayoutTransfer } from "./taskTypes.js";
import type { SendDeps } from "./types.js";

const TRANSFER_ID = "transfer-1";

// A gateway with one pending payout row and no task: the worker only sends.
const setup = () => {
	const gateway = createTestGateway();
	const ledger = taskLedger(gateway.database);
	ledger.insert(
		{
			id: TRANSFER_ID,
			taskId: "task-1",
			kind: PayoutKind.Payout,
			legs: [
				{ role: LegRole.Linguist, wallet: WALLETS.linguist.address, units: 1n },
			],
			memo: "hr:task-1",
		},
		gateway.clock.now(),
	);
	const row = (): PayoutTransfer => {
		const found = ledger.find(TRANSFER_ID);
		if (!found) {
			throw new Error("transfer row is missing");
		}
		return found;
	};
	const count = (method: string) =>
		gateway.chain.calls.filter((call) => call.method === method).length;
	const operatorLogs = () =>
		gateway.logs.filter((line) => line.includes("OPERATOR ACTION REQUIRED"));
	const deps: SendDeps<PayoutTransfer> = {
		ledger,
		chain: gateway.chain,
		sign: (transfer) =>
			gateway.chain.signPayout({ legs: [], memo: transfer.memo }),
		describe: (transfer) => `task ${transfer.taskId}`,
		maxAttempts: 10,
		now: gateway.clock.now,
		log: (msg) => gateway.logs.push(`[payouts] ${msg}`),
	};

	return { ...gateway, ledger, row, count, operatorLogs, deps };
};

describe("payouts send", () => {
	it("PO-20 stores the signature and blockhash as sent before broadcasting", async () => {
		const gateway = setup();
		const seen: PayoutTransfer[] = [];
		gateway.chain.answer.broadcast = async () => {
			seen.push(gateway.row());
			return chainOk("payout-sig-1");
		};

		await gateway.worker.tick();

		expect(seen).toHaveLength(1);
		expect(seen[0]).toMatchObject({
			status: TransferStatus.Sent,
			txSig: "payout-sig-1",
			blockhash: FAKE_BLOCKHASH,
			lastValidBlockHeight: 1000,
		});
	});

	it("PO-21 a retryable broadcast error puts the transfer back to pending with attempts + 1 and clears the old signature", async () => {
		const gateway = setup();
		gateway.chain.answer.broadcast = async () =>
			chainFail(ErrorKind.Retryable, "429 Too Many Requests");

		await gateway.worker.tick();

		expect(gateway.row()).toMatchObject({
			status: TransferStatus.Pending,
			attempts: 1,
			txSig: null,
			blockhash: null,
			lastValidBlockHeight: null,
			lastError: "429 Too Many Requests",
		});
	});

	it.each([
		[1, 4_000],
		[5, 60_000],
		[7, 60_000],
	])(
		"PO-22 does not retry before the backoff (attempts %i, wait %i ms)",
		async (attempts, wait) => {
			const gateway = setup();
			gateway.chain.answer.signatureStatus = async () =>
				chainOk({ state: "pending" });
			for (let index = 0; index < attempts; index += 1) {
				gateway.ledger.backToPending(TRANSFER_ID, "retry", gateway.clock.now());
			}

			gateway.clock.advance(wait - 1);
			await gateway.worker.tick();
			expect(gateway.count("signPayout")).toBe(0);

			gateway.clock.advance(1);
			await gateway.worker.tick();
			expect(gateway.count("signPayout")).toBe(1);
			expect(gateway.row().status).toBe(TransferStatus.Sent);
		},
	);

	it("PO-23 a final signing error marks the transfer failed and logs OPERATOR ACTION REQUIRED once", async () => {
		const gateway = setup();
		gateway.chain.answer.signPayout = async () =>
			chainFail(ErrorKind.Final, "payout leg has an invalid wallet address");
		const stale = gateway.row();

		await gateway.worker.tick();
		await gateway.worker.tick();
		fail(gateway.deps, stale, "second report");

		expect(gateway.row()).toMatchObject({
			status: TransferStatus.Failed,
			lastError: "payout leg has an invalid wallet address",
			txSig: null,
		});
		expect(gateway.count("broadcast")).toBe(0);
		expect(gateway.operatorLogs()).toHaveLength(1);
		expect(gateway.operatorLogs()[0]).toContain(`transfer ${TRANSFER_ID}`);
	});

	it("PO-24 a final broadcast error marks the transfer failed and keeps its signature", async () => {
		const gateway = setup();
		gateway.chain.answer.broadcast = async () =>
			chainFail(ErrorKind.Final, "insufficient funds");

		await gateway.worker.tick();

		expect(gateway.row()).toMatchObject({
			status: TransferStatus.Failed,
			txSig: "payout-sig-1",
			lastValidBlockHeight: 1000,
			attempts: 0,
			lastError: "insufficient funds",
		});
		expect(gateway.operatorLogs()).toHaveLength(1);
	});

	it("PO-25 an ambiguous broadcast error keeps the transfer sent and signs nothing new (CH-06)", async () => {
		const gateway = setup();
		gateway.chain.answer.broadcast = async () =>
			chainFail(ErrorKind.Ambiguous, "request timed out");
		gateway.chain.answer.signatureStatus = async () =>
			chainOk({ state: "unknown" });
		let height = 1;
		gateway.chain.answer.blockHeight = async () => chainOk(height);

		for (const at of [1, 999, 1000]) {
			height = at;
			gateway.clock.advance(60_000);
			await gateway.worker.tick();
			expect(gateway.row()).toMatchObject({
				status: TransferStatus.Sent,
				txSig: "payout-sig-1",
				attempts: 0,
			});
		}
		expect(gateway.count("signPayout")).toBe(1);
		expect(gateway.count("findMemo")).toBe(0);

		// Only the ADR 0006 guard (expired, no memo) lets it go back to pending.
		height = 1001;
		await gateway.worker.tick();
		expect(gateway.row().status).toBe(TransferStatus.Pending);
		expect(gateway.count("signPayout")).toBe(1);
	});

	it("PO-26 gives up after 10 attempts and marks the transfer failed", async () => {
		const gateway = setup();
		gateway.chain.answer.broadcast = async () =>
			chainFail(ErrorKind.Retryable, "Blockhash not found");

		for (let tick = 0; tick < 12; tick += 1) {
			await gateway.worker.tick();
			gateway.clock.advance(60_000);
		}

		expect(gateway.count("signPayout")).toBe(10);
		expect(gateway.count("broadcast")).toBe(10);
		expect(gateway.row()).toMatchObject({
			status: TransferStatus.Failed,
			attempts: 9,
			lastError: "gave up after 10 attempts: Blockhash not found",
		});
		expect(gateway.operatorLogs()).toHaveLength(1);
	});

	it("PO-27 two overlapping ticks of one worker sign and send each transfer once", async () => {
		const gateway = setup();
		const original = gateway.chain.answer.signPayout;
		let release = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		gateway.chain.answer.signPayout = async (req) => {
			await gate;
			return original(req);
		};

		try {
			const first = gateway.worker.tick();
			await gateway.worker.tick();
			expect(gateway.count("signPayout")).toBe(1);
			release();
			await first;
			await gateway.worker.tick();
		} finally {
			release();
		}

		expect(gateway.count("signPayout")).toBe(1);
		expect(gateway.count("broadcast")).toBe(1);
		expect(gateway.row().status).toBe(TransferStatus.Confirmed);
	});

	it("NEW-25 a failed pending-to-sent guarded write prevents broadcast", async () => {
		const gateway = setup();
		const deps = {
			...gateway.deps,
			ledger: { ...gateway.ledger, markSent: () => false },
		};

		await sendPending(deps, gateway.row());

		expect(gateway.count("signPayout")).toBe(1);
		expect(gateway.count("broadcast")).toBe(0);
		expect(gateway.count("signatureStatus")).toBe(0);
		expect(gateway.row()).toMatchObject({
			status: TransferStatus.Pending,
			txSig: null,
			attempts: 0,
			lastError: null,
		});
	});
});
