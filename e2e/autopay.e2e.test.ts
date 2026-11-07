// Agent auto-pay (ADR 0036) on chain: allowance, delegate payment, refusals, refunds.
import { describe, expect, test } from "vitest";
import { revokeAllowance } from "./support/agent.js";
import {
	autopayFirm,
	autopayPay,
	closeAutopay,
	payTxOf,
	tokenAccount,
} from "./support/autopay.js";
import { txFacts, usdcOf } from "./support/chain.js";
import { e2eEnv } from "./support/env.js";
import { FirmSlot } from "./support/firms.js";
import { team } from "./support/fixture.js";
import { call } from "./support/http.js";
import { draftOf, postTask } from "./support/mcpFlow.js";
import {
	claim,
	orderTasks,
	reject,
	submit,
	taskOf,
	waitConfirmed,
} from "./support/tasks.js";

const orderIdOf = (text: string): string =>
	/orderId ([0-9a-f-]{36})/.exec(text)?.[1] ?? "";

describe("agent auto-pay", () => {
	test("the firm approves an allowance for the agent key and GET /api/firm/autopay shows delegate and allowance", async () => {
		const fixture = await autopayFirm(FirmSlot.AutopayPay, 3_000_000n);
		try {
			const view = await call(e2eEnv().gatewayUrl, "GET", "/api/firm/autopay", {
				jar: fixture.firm.jar,
			});
			expect(view.exists).toBe(true);
			expect(view.delegate).toBe(fixture.agent.publicKey);
			expect(view.allowanceUnits).toBe("3000000");
			expect(view.payTo).toBe(e2eEnv().holdAddress);
			expect(view.mint).toBe(e2eEnv().mint);
		} finally {
			await closeAutopay(fixture);
		}
	});

	test("prepare_payment → sign.mjs → pay_task pays from the firm's account", async () => {
		const env = e2eEnv();
		const fixture = await autopayFirm(FirmSlot.AutopayPay, 3_000_000n);
		try {
			const wallet = fixture.firm.key.publicKey.toBase58();
			const draft = draftOf(await postTask(fixture.mcp, ["es", "fr"]));
			const before = await tokenAccount(wallet);

			const reply = await autopayPay(fixture, draft.draftId);

			expect(reply.isError, reply.text).toBe(false);
			const facts = await txFacts(payTxOf(reply));
			expect(facts.deltas.get(wallet)).toBe(-draft.totalUnits);
			expect(facts.deltas.get(env.holdAddress)).toBe(draft.totalUnits);
			const after = await tokenAccount(wallet);
			expect(after.delegatedAmount).toBe(
				before.delegatedAmount - draft.totalUnits,
			);
			const order = await call(
				env.gatewayUrl,
				"GET",
				`/api/orders/${orderIdOf(reply.text)}`,
				{
					jar: fixture.firm.jar,
				},
			);
			expect(order.payer).toBe(fixture.agent.publicKey);
		} finally {
			await closeAutopay(fixture);
		}
	});

	test("refunds of an auto-paid order go to the firm wallet, not the delegate", async () => {
		const fixture = await autopayFirm(FirmSlot.AutopayPay, 3_000_000n);
		try {
			const { linguist } = await team();
			const draft = draftOf(await postTask(fixture.mcp, ["de"]));
			const reply = await autopayPay(fixture, draft.draftId);
			const orderId = orderIdOf(reply.text);
			const taskId = taskOf(
				await orderTasks(fixture.firm.jar, orderId),
				"de",
			).taskId;
			await claim(linguist.jar, taskId);
			await submit(linguist.jar, taskId);
			await reject(
				fixture.firm.jar,
				taskId,
				"e2e: refund of an auto-paid order",
			);
			const done = await waitConfirmed(fixture.firm.jar, orderId, taskId);

			const facts = await txFacts(done.transferTx ?? "");
			expect(facts.deltas.get(fixture.firm.key.publicKey.toBase58())).toBe(
				500_000n,
			);
			expect(facts.deltas.has(fixture.agent.publicKey)).toBe(false);
			expect(await usdcOf(fixture.agent.publicKey)).toBe(0n);
		} finally {
			await closeAutopay(fixture);
		}
	});

	test("a payment above the remaining allowance is refused before signing", async () => {
		const fixture = await autopayFirm(FirmSlot.AutopayRefusals, 700_000n);
		try {
			const wallet = fixture.firm.key.publicKey.toBase58();
			const left = (await tokenAccount(wallet)).delegatedAmount;
			expect(left).toBe(700_000n);
			const draft = draftOf(await postTask(fixture.mcp, ["es", "fr"]));
			const balance = await usdcOf(wallet);

			const prepared = await fixture.mcp.call("prepare_payment", {
				draftId: draft.draftId,
			});

			expect(prepared.isError).toBe(true);
			expect(prepared.text).toContain(
				"auto-pay limit is too low (0.70 USDC left)",
			);
			expect(prepared.text).not.toContain("sign.mjs");
			expect(await usdcOf(wallet)).toBe(balance);
			const status = await call(
				e2eEnv().gatewayUrl,
				"GET",
				`/api/orders/draft/${draft.draftId}`,
			);
			expect(status.state).toBe("draft");
		} finally {
			await closeAutopay(fixture);
		}
	});

	test("after Revoke prepare_payment answers auto-pay is off", async () => {
		const fixture = await autopayFirm(FirmSlot.AutopayRefusals, 2_000_000n);
		try {
			await revokeAllowance(fixture.firm.key);
			const account = await tokenAccount(fixture.firm.key.publicKey.toBase58());
			expect(account.delegate).toBeNull();
			const draft = draftOf(await postTask(fixture.mcp, ["es"]));

			const prepared = await fixture.mcp.call("prepare_payment", {
				draftId: draft.draftId,
			});

			expect(prepared.isError).toBe(true);
			expect(prepared.text).toContain("auto-pay is off for this firm");
		} finally {
			await closeAutopay(fixture);
		}
	});
});
