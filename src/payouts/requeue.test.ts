import { describe, expect, test } from "vitest";
import { ErrorKind, type SignatureStatus } from "../chain/index.js";
import { TransferStatus } from "../store/index.js";
import {
	chainFail,
	chainOk,
	createTestGateway,
	FAKE_BLOCKHASH,
	LAST_VALID,
	OLD_SIG,
	START,
	seedTransfer,
} from "../testing/index.js";
import { taskLedger } from "./ledger.js";
import { requeueTransfer } from "./requeue.js";
import { PayoutKind } from "./taskTypes.js";

const TRANSFER_ID = "transfer-1";
const TASK_ID = "task-1";
const MEMO = "hr:task-1";

// A gateway with one failed payout row; `broadcast` says whether it was ever sent as OLD_SIG.
const setup = (broadcast = true, attempts = 0) => {
	const gateway = createTestGateway();
	const { ledger, row, count } = seedTransfer(gateway, {
		status: TransferStatus.Failed,
		broadcast,
		attempts,
	});
	gateway.chain.answer.signatureStatus = async () =>
		chainOk({ state: "unknown" });
	gateway.chain.answer.blockHeight = async () => chainOk(LAST_VALID + 1);

	const requeue = (idOrTaskId = TRANSFER_ID, store = ledger) =>
		requeueTransfer(
			{ store, chain: gateway.chain, now: gateway.clock.now },
			idOrTaskId,
		);

	return { ...gateway, ledger, row, count, requeue, before: row() };
};

const refused = (reason: string) => ({ outcome: "refused", reason });

describe("operator requeue", () => {
	test("refuses an unknown id and a transfer that is not failed", async () => {
		const gateway = setup();
		expect(await gateway.requeue("nope")).toEqual(
			refused("no transfer with id or task id nope"),
		);

		const fresh = createTestGateway();
		const ledger = taskLedger(fresh.database);
		ledger.insert(
			{
				id: "t2",
				taskId: "task-2",
				kind: PayoutKind.Refund,
				legs: [],
				memo: "hr:task-2:late",
			},
			fresh.clock.now(),
		);
		const store = { store: ledger, chain: fresh.chain, now: fresh.clock.now };
		expect(await requeueTransfer(store, "t2")).toEqual(
			refused("transfer t2 is pending, not failed"),
		);
		ledger.markSent(
			"t2",
			{ txSig: "s", blockhash: FAKE_BLOCKHASH, lastValidBlockHeight: 1 },
			fresh.clock.now(),
		);
		expect(await requeueTransfer(store, "t2")).toEqual(
			refused("transfer t2 is sent, not failed"),
		);
		ledger.markConfirmed("t2", "s", fresh.clock.now());
		expect(await requeueTransfer(store, "t2")).toEqual(
			refused("transfer t2 is confirmed, not failed"),
		);
		expect(fresh.chain.calls).toEqual([]);
	});

	test("requeues a failed transfer that was never broadcast", async () => {
		const gateway = setup(false);
		const result = await gateway.requeue();

		expect(result.outcome).toBe("requeued");
		expect(gateway.row()).toMatchObject({
			status: TransferStatus.Pending,
			txSig: null,
			lastError: null,
		});
		expect(gateway.chain.calls).toEqual([]);
	});

	const known: [string, SignatureStatus][] = [
		["pending", { state: "pending" }],
		["confirmed", { state: "confirmed" }],
		["failed on chain", { state: "failed", error: "{}" }],
	];
	test.each(known)(
		"refuses while the chain knows the old signature (%s)",
		async (_name, status) => {
			const gateway = setup();
			gateway.chain.answer.signatureStatus = async () => chainOk(status);

			expect(await gateway.requeue()).toEqual(
				refused(`chain reports ${OLD_SIG} as ${status.state}`),
			);
			expect(gateway.row()).toEqual(gateway.before);
			expect(gateway.count("findMemo")).toBe(0);
		},
	);

	test.each([LAST_VALID, LAST_VALID - 1])(
		"refuses while the old blockhash can still land (height %i)",
		async (at) => {
			const gateway = setup();
			gateway.chain.answer.blockHeight = async () => chainOk(at);

			expect(await gateway.requeue()).toEqual(
				refused(
					`block height not past ${LAST_VALID}; ${OLD_SIG} may still land`,
				),
			);
			expect(gateway.count("findMemo")).toBe(0);
			expect(gateway.row()).toEqual(gateway.before);
		},
	);

	test("refuses when a hold transaction already carries the memo", async () => {
		const gateway = setup();
		gateway.chain.answer.findMemo = async () =>
			chainOk({ state: "found", signature: "memo-sig" });

		expect(await gateway.requeue()).toEqual(
			refused(`memo ${MEMO} found in memo-sig`),
		);
		expect(gateway.row()).toEqual(gateway.before);
	});

	test("requeues when the signature is unknown, the blockhash expired and no memo exists", async () => {
		const gateway = setup(true, 3);
		gateway.clock.advance(100_000);
		const result = await gateway.requeue();

		expect(result.outcome).toBe("requeued");
		expect(gateway.row()).toMatchObject({
			status: TransferStatus.Pending,
			txSig: null,
			blockhash: null,
			lastValidBlockHeight: null,
			lastError: null,
			attempts: 3,
			updatedAt: START + 100_000,
		});
		expect(gateway.count("broadcast")).toBe(0);
		expect(gateway.count("signPayout")).toBe(0);

		// attempts 3: the worker waits 16 s from the requeue.
		gateway.clock.advance(15_999);
		await gateway.worker.tick();
		expect(gateway.count("signPayout")).toBe(0);
		gateway.clock.advance(1);
		await gateway.worker.tick();
		expect(gateway.count("signPayout")).toBe(1);
	});

	test("finds the transfer by task id as well as by transfer id", async () => {
		const gateway = setup(false);
		const result = await gateway.requeue(TASK_ID);

		expect(result).toMatchObject({
			outcome: "requeued",
			transfer: { id: TRANSFER_ID, taskId: TASK_ID },
		});
	});

	test.each(["signatureStatus", "blockHeight", "findMemo"])(
		"reports an RPC failure as an error and changes nothing (%s)",
		async (method) => {
			const gateway = setup();
			const down = chainFail(ErrorKind.Retryable, "fetch failed");
			if (method === "signatureStatus") {
				gateway.chain.answer.signatureStatus = async () => down;
			} else if (method === "blockHeight") {
				gateway.chain.answer.blockHeight = async () => down;
			} else {
				gateway.chain.answer.findMemo = async () => down;
			}

			expect(await gateway.requeue()).toEqual({
				outcome: "error",
				error: "fetch failed",
			});
			expect(gateway.row()).toEqual(gateway.before);
		},
	);

	test("requeue refuses incomplete metadata and a row changed during investigation", async () => {
		const gateway = setup();
		gateway.database
			.prepare(
				"UPDATE transfers SET last_valid_block_height = NULL WHERE id = ?",
			)
			.run(TRANSFER_ID);
		expect(await gateway.requeue()).toEqual(
			refused(`signature ${OLD_SIG} has no last_valid_block_height`),
		);
		expect(gateway.chain.calls).toEqual([]);

		const raced = setup();
		const store = { ...raced.ledger, requeue: () => false };
		expect(await raced.requeue(TRANSFER_ID, store)).toEqual(
			refused(`transfer ${TRANSFER_ID} changed status during the check`),
		);
		expect(raced.count("findMemo")).toBe(1);
		expect(raced.row()).toEqual(raced.before);
		await raced.worker.tick();
		expect(raced.count("signPayout")).toBe(0);
	});

	test("memo lookup distinguishes a successful exact memo from misleading or incomplete history (requeue refuses an uncovered history)", async () => {
		const gateway = setup();
		gateway.chain.answer.findMemo = async () => chainOk({ state: "uncovered" });

		expect(await gateway.requeue()).toEqual(
			refused(`memo history of the hold wallet not covered back to ${START}`),
		);
		const memoCall = gateway.chain.calls.find(
			(call) => call.method === "findMemo",
		);
		expect(memoCall?.args).toEqual([MEMO, START]);
		expect(gateway.row()).toEqual(gateway.before);
		await gateway.worker.tick();
		expect(gateway.count("signPayout")).toBe(0);
		expect(gateway.count("broadcast")).toBe(0);
	});
});
