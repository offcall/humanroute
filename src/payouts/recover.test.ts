import { afterEach, describe, expect, test, vi } from "vitest";
import {
	type ChainResult,
	ErrorKind,
	type SignatureStatus,
} from "../chain/index.js";
import { TransferStatus } from "../store/index.js";
import {
	chainFail,
	chainOk,
	createTestGateway,
	LAST_VALID,
	OLD_SIG,
	START,
	seedTransfer,
} from "../testing/index.js";
import { createTaskWorker } from "./taskWorker.js";

const TRANSFER_ID = "transfer-1";
const MEMO = "hr:task-1";

// A gateway with one payout row already sent as OLD_SIG (valid up to height 1000).
const setup = () => {
	const gateway = createTestGateway();
	const { ledger, row, count } = seedTransfer(gateway, {
		status: TransferStatus.Sent,
	});
	const statuses = (bySig: Record<string, SignatureStatus>) => {
		gateway.chain.answer.signatureStatus = async (sig) => {
			const status = bySig[sig];
			return status ? chainOk(status) : chainOk({ state: "unknown" });
		};
	};
	const height = (value: number) => {
		gateway.chain.answer.blockHeight = async () => chainOk(value);
	};

	return { ...gateway, ledger, row, count, statuses, height };
};

const unchangedSent = {
	status: TransferStatus.Sent,
	txSig: OLD_SIG,
	lastValidBlockHeight: LAST_VALID,
	attempts: 0,
};

afterEach(() => {
	vi.useRealTimers();
});

describe("payouts recovery of sent transfers", () => {
	test("a sent transfer becomes confirmed when its signature is confirmed", async () => {
		const gateway = setup();
		await gateway.worker.tick();

		expect(gateway.row()).toMatchObject({
			status: TransferStatus.Confirmed,
			txSig: OLD_SIG,
		});
		expect(gateway.count("signPayout")).toBe(0);
	});

	test("a sent transfer stays sent while its signature is pending", async () => {
		const gateway = setup();
		gateway.statuses({ [OLD_SIG]: { state: "pending" } });
		gateway.height(LAST_VALID + 50);

		await gateway.worker.tick();

		expect(gateway.row()).toMatchObject(unchangedSent);
		expect(gateway.count("findMemo")).toBe(0);
		expect(gateway.count("signPayout")).toBe(0);
	});

	test("a sent transfer becomes failed when the chain reports an on-chain error", async () => {
		const gateway = setup();
		gateway.statuses({ [OLD_SIG]: { state: "failed", error: '{"Custom":1}' } });

		await gateway.worker.tick();

		expect(gateway.row()).toMatchObject({
			status: TransferStatus.Failed,
			txSig: OLD_SIG,
			lastError: `on-chain error: {"Custom":1} sig ${OLD_SIG}`,
		});
		expect(gateway.count("signPayout")).toBe(0);
	});

	test.each([LAST_VALID, LAST_VALID - 1])(
		"nothing happens while the signature is unknown and the blockhash can still land (height %i)",
		async (at) => {
			const gateway = setup();
			gateway.statuses({});
			gateway.height(at);

			await gateway.worker.tick();

			expect(gateway.row()).toMatchObject(unchangedSent);
			expect(gateway.count("findMemo")).toBe(0);
			expect(gateway.count("signPayout")).toBe(0);
		},
	);

	test("an unknown signature with an expired blockhash and a confirmed hold transaction carrying the memo is confirmed with that transaction", async () => {
		const gateway = setup();
		gateway.statuses({ "memo-sig": { state: "confirmed" } });
		gateway.height(LAST_VALID + 1);
		gateway.chain.answer.findMemo = async () =>
			chainOk({ state: "found", signature: "memo-sig" });

		await gateway.worker.tick();

		expect(gateway.row()).toMatchObject({
			status: TransferStatus.Confirmed,
			txSig: "memo-sig",
		});
		expect(gateway.count("signPayout")).toBe(0);
		expect(gateway.count("broadcast")).toBe(0);
	});

	const unresolved: [string, ChainResult<SignatureStatus>][] = [
		["pending", chainOk({ state: "pending" })],
		["failed", chainOk({ state: "failed", error: "{}" })],
		["unknown", chainOk({ state: "unknown" })],
		["unavailable", chainFail(ErrorKind.Retryable, "fetch failed")],
	];
	test.each(unresolved)(
		"a discovered memo never permits resend while its signature is unresolved (%s)",
		async (_name, memoStatus) => {
			const gateway = setup();
			gateway.height(LAST_VALID + 1);
			gateway.chain.answer.findMemo = async () =>
				chainOk({ state: "found", signature: "memo-sig" });
			gateway.chain.answer.signatureStatus = async (sig) =>
				sig === OLD_SIG ? chainOk({ state: "unknown" }) : memoStatus;

			for (let tick = 0; tick < 3; tick += 1) {
				gateway.clock.advance(60_000);
				await gateway.worker.tick();
			}

			expect(gateway.row()).toMatchObject(unchangedSent);
			expect(gateway.count("signPayout")).toBe(0);
		},
	);

	test("an unknown signature with an expired blockhash and no memo goes back to pending and is re-signed after the backoff", async () => {
		const gateway = setup();
		gateway.statuses({});
		gateway.height(LAST_VALID + 1);

		await gateway.worker.tick();

		expect(gateway.row()).toMatchObject({
			status: TransferStatus.Pending,
			txSig: null,
			blockhash: null,
			lastValidBlockHeight: null,
			attempts: 1,
			lastError: `signature ${OLD_SIG} unseen after block height ${LAST_VALID}`,
		});
		await gateway.worker.tick();
		gateway.clock.advance(3_999);
		await gateway.worker.tick();
		expect(gateway.count("signPayout")).toBe(0);

		gateway.statuses({ "payout-sig-1": { state: "confirmed" } });
		gateway.clock.advance(1);
		await gateway.worker.tick();
		expect(gateway.count("signPayout")).toBe(1);
		expect(gateway.row()).toMatchObject({
			status: TransferStatus.Confirmed,
			txSig: "payout-sig-1",
		});
	});

	test.each([
		["status", "signatureStatus"],
		["height", "blockHeight"],
		["memo", "findMemo"],
	])(
		"no decision while the RPC is unavailable (%s read fails)",
		async (_name, method) => {
			const gateway = setup();
			gateway.statuses({});
			gateway.height(LAST_VALID + 1);
			const down = chainFail(ErrorKind.Retryable, "fetch failed");
			if (method === "signatureStatus") {
				gateway.chain.answer.signatureStatus = async () => down;
			} else if (method === "blockHeight") {
				gateway.chain.answer.blockHeight = async () => down;
			} else {
				gateway.chain.answer.findMemo = async () => down;
			}

			await gateway.worker.tick();
			await gateway.worker.tick();

			expect(gateway.row()).toMatchObject(unchangedSent);
			expect(gateway.row().lastError).toBeNull();
			expect(gateway.count("signPayout")).toBe(0);
		},
	);

	describe("worker start recovers sent transfers left by a crash", () => {
		test("landed but unobserved: confirmed on start", async () => {
			vi.useFakeTimers();
			const gateway = setup();
			const restarted = createTaskWorker(gateway.payouts);

			await restarted.start();
			restarted.stop();

			expect(gateway.row()).toMatchObject({
				status: TransferStatus.Confirmed,
				txSig: OLD_SIG,
			});
			expect(gateway.count("signPayout")).toBe(0);
		});

		test("crashed before broadcast: not re-signed while live, re-signed once after expiry with no memo", async () => {
			vi.useFakeTimers();
			const gateway = setup();
			gateway.statuses({});
			gateway.height(LAST_VALID);
			const restarted = createTaskWorker(gateway.payouts);

			await restarted.start();
			try {
				expect(gateway.row()).toMatchObject(unchangedSent);
				await restarted.tick();
				expect(gateway.count("signPayout")).toBe(0);

				gateway.height(LAST_VALID + 1);
				await restarted.tick();
				expect(gateway.row().status).toBe(TransferStatus.Pending);
				gateway.statuses({ "payout-sig-1": { state: "confirmed" } });
				gateway.clock.advance(4_000);
				await restarted.tick();
				await restarted.tick();
			} finally {
				restarted.stop();
			}

			expect(gateway.count("signPayout")).toBe(1);
			expect(gateway.count("broadcast")).toBe(1);
			expect(gateway.row()).toMatchObject({
				status: TransferStatus.Confirmed,
				txSig: "payout-sig-1",
			});
		});
	});

	test("a sent row without signature or last valid block height goes back to pending with attempts + 1", async () => {
		const gateway = setup();
		const clear = (column: string) =>
			gateway.database
				.prepare(`UPDATE transfers SET ${column} = NULL WHERE id = ?`)
				.run(TRANSFER_ID);

		clear("last_valid_block_height");
		await gateway.worker.tick();
		expect(gateway.row()).toMatchObject({
			status: TransferStatus.Pending,
			attempts: 1,
			txSig: null,
		});
		expect(gateway.count("signatureStatus")).toBe(0);

		const other = setup();
		other.database
			.prepare("UPDATE transfers SET blockhash = NULL WHERE id = ?")
			.run(TRANSFER_ID);
		await other.worker.tick();
		expect(other.row()).toMatchObject({
			status: TransferStatus.Confirmed,
			txSig: OLD_SIG,
			attempts: 0,
		});
	});

	describe("memo lookup distinguishes a successful exact memo from misleading or incomplete history (worker)", () => {
		test("searches back to the transfer's creation and fails an uncovered history without signing", async () => {
			const gateway = setup();
			gateway.statuses({});
			gateway.height(LAST_VALID + 1);
			gateway.chain.answer.findMemo = async () =>
				chainOk({ state: "uncovered" });

			for (let tick = 0; tick < 3; tick += 1) {
				gateway.clock.advance(60_000);
				await gateway.worker.tick();
			}

			const memoCalls = gateway.chain.calls.filter(
				(call) => call.method === "findMemo",
			);
			expect(memoCalls[0]?.args).toEqual([MEMO, START]);
			expect(gateway.row()).toMatchObject({
				status: TransferStatus.Failed,
				txSig: OLD_SIG,
				attempts: 0,
				lastError: `memo history of the hold wallet not covered back to ${START}`,
			});
			expect(gateway.count("signPayout")).toBe(0);
			expect(gateway.count("broadcast")).toBe(0);
			const operator = gateway.logs.filter((line) =>
				line.includes("OPERATOR ACTION REQUIRED"),
			);
			expect(operator).toHaveLength(1);
		});
	});
});
