// EE-19 (flow.md row 30): the gateway dies while a payout row is sent; a restart on the same
// file DB never pays twice. Its own gateway process, behind a JSON-RPC gate. Localnet only.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startGateway } from "./env/apps.js";
import { freePort, killProcess } from "./env/process.js";
import { E2eMode } from "./env/types.js";
import { ataOf, usdcOf } from "./support/chain.js";
import { connection, e2eEnv, pollUntil, useGateway } from "./support/env.js";
import { FirmSlot } from "./support/firms.js";
import { firmAt, paidOrder, team } from "./support/fixture.js";
import { GateMode, startRpcGate } from "./support/rpcGate.js";
import {
	approve,
	claim,
	orderTasks,
	submit,
	waitConfirmed,
} from "./support/tasks.js";

const localnet = e2eEnv().mode === E2eMode.Localnet;
const CASE_MS = 240_000;
const cleanups: (() => Promise<void> | void)[] = [];

// Pays one task through a fresh gateway, crashes it while the payout send is held by the gate,
// and restarts it on the same DB and port with the gate open again.
const crashDuringSend = async (mode: GateMode) => {
	const env = e2eEnv();
	const dir = mkdtempSync(join(tmpdir(), "hr-restart-"));
	cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
	const gate = await startRpcGate(env.rpcUrl);
	cleanups.push(gate.stop);
	const port = await freePort();
	const gatewayEnv = {
		...(env.gatewayEnv ?? {}),
		RPC_URL: gate.url,
		DB_PATH: join(dir, "gateway.db"),
	};
	// Logs next to the run's logs (kept with E2E_KEEP_LOGS=1).
	const start = async () => {
		const app = await startGateway(
			gatewayEnv,
			env.logDir,
			port,
			`gateway-${mode}`,
		);
		cleanups.push(app.stop);
		return app;
	};
	const first = await start();
	useGateway(first.url);

	const firm = await firmAt(FirmSlot.OrderRestart);
	const { linguist } = await team();
	const order = await paidOrder(firm, ["es"]);
	const taskId = order.task("es").taskId;
	await claim(linguist.jar, taskId);
	await submit(linguist.jar, taskId);
	gate.mode = mode;
	await approve(firm.jar, taskId);
	const landed = await gate.held;
	await killProcess(first.running);
	gate.mode = GateMode.Pass;
	await start();
	const wallet = linguist.key.publicKey.toBase58();
	return { firm, order, taskId, wallet, landed };
};

const successes = async (wallet: string) =>
	(await connection().getSignaturesForAddress(ataOf(wallet))).filter(
		(entry) => entry.err === null,
	);

describe.runIf(localnet)("EE-19 restart with a sent payout", () => {
	afterEach(async () => {
		useGateway(null);
		for (const step of cleanups.splice(0).reverse()) {
			await step();
		}
	});

	it(
		"EE-19 a gateway restart with a sent row does not pay twice (landed, reply lost)",
		async () => {
			const { firm, order, taskId, wallet, landed } = await crashDuringSend(
				GateMode.LandNoReply,
			);

			const done = await waitConfirmed(
				firm.jar,
				order.paid.orderId,
				taskId,
				120_000,
			);

			expect(done.publicState).toBe("paid_out");
			expect(done.transferTx).toBe(landed);
			expect(await usdcOf(wallet)).toBe(400_000n);
			const succeeded = await successes(wallet);
			expect(succeeded.map((entry) => entry.signature)).toEqual([landed]);
			expect(succeeded[0]?.memo ?? "").toContain(`hr:${taskId}`);
		},
		CASE_MS,
	);

	// Characterized: the memo guard (src/chain/memo.ts, ADR 0039) proves the resend window only
	// with a hold signature older than the row minus 600 s. A localnet hold wallet is minutes old,
	// so the restart stops for the operator instead of resending; the resend path needs an older
	// hold wallet (devnet). Either way nothing is paid twice.
	it(
		"EE-19 a gateway restart with a sent row does not pay twice (dropped before the chain)",
		async () => {
			const { firm, order, taskId, wallet } = await crashDuringSend(
				GateMode.DropBeforeChain,
			);

			const read = async () =>
				(await orderTasks(firm.jar, order.paid.orderId)).find(
					(task) => task.taskId === taskId,
				);
			const stopped = await pollUntil(
				read,
				(task) => task?.transferStatus === "failed",
				// Recovery first waits for the dropped send's blockhash to expire.
				150_000,
				"operator stop",
			);

			expect(stopped?.publicState).toBe("paying_out");
			expect(await usdcOf(wallet)).toBe(0n);
			expect(await successes(wallet)).toEqual([]);
		},
		CASE_MS,
	);
});
