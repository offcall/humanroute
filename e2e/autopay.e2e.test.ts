// Agent auto-pay (ADR 0036) on chain: a delegate payment, and one whose funds moved before
// settlement (flow.md row 16), refused by the real facilitator's simulation.
import {
	createAssociatedTokenAccountIdempotent,
	transfer,
} from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, test } from "vitest";
import {
	type AutopayFirm,
	autopayFirm,
	autopayPay,
	closeAutopay,
	payTxOf,
	prepareAndSign,
	tokenAccount,
} from "./support/autopay.js";
import { ataOf, txFacts, usdcOf } from "./support/chain.js";
import { connection, e2eEnv } from "./support/env.js";
import { FirmSlot } from "./support/firms.js";
import { call } from "./support/http.js";
import { draftOf, postTask } from "./support/mcp.js";

const orderIdOf = (text: string): string =>
	/orderId ([0-9a-f-]{36})/.exec(text)?.[1] ?? "";

const moveAllFunds = async ({ firm }: AutopayFirm): Promise<void> => {
	const sink = Keypair.generate().publicKey;
	const mint = new PublicKey(e2eEnv().mint);
	const to = await createAssociatedTokenAccountIdempotent(
		connection(),
		firm.key,
		mint,
		sink,
	);
	const wallet = firm.key.publicKey.toBase58();
	await transfer(
		connection(),
		firm.key,
		ataOf(wallet),
		to,
		firm.key,
		await usdcOf(wallet),
	);
};

describe("agent auto-pay", () => {
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
				{ jar: fixture.firm.jar },
			);
			expect(order.payer).toBe(fixture.agent.publicKey);
		} finally {
			await closeAutopay(fixture);
		}
	});

	test("a prepared payment fails safely if the funds move before settlement", async () => {
		const fixture = await autopayFirm(FirmSlot.AutopayChanged, 2_000_000n);
		try {
			const draft = draftOf(await postTask(fixture.mcp, ["es"]));
			const signature = await prepareAndSign(fixture, draft.draftId);
			await moveAllFunds(fixture);
			const wallet = fixture.firm.key.publicKey.toBase58();
			const before = await usdcOf(wallet);

			const reply = await fixture.mcp.call("pay_task", {
				draftId: draft.draftId,
				signature,
			});

			expect(reply.isError).toBe(true);
			expect(reply.text).toContain("call prepare_payment again");
			expect(await usdcOf(wallet)).toBe(before);
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
});
