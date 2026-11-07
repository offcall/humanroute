// NEW-09 (flow.md row 15): a signed delegate payment whose allowance or balance changed before
// settlement is refused by the real facilitator's simulation; nothing moves, no order.
import {
	createAssociatedTokenAccountIdempotent,
	transfer,
} from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { approveAllowance, revokeAllowance } from "./support/agent.js";
import {
	type AutopayFirm,
	autopayFirm,
	closeAutopay,
	prepareAndSign,
} from "./support/autopay.js";
import { ataOf, usdcOf } from "./support/chain.js";
import { connection, e2eEnv } from "./support/env.js";
import { FirmSlot } from "./support/firms.js";
import { call } from "./support/http.js";
import { draftOf, postTask } from "./support/mcpFlow.js";

type Change = (fixture: AutopayFirm) => Promise<unknown>;

const moveAllFunds: Change = async ({ firm }) => {
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

const CHANGES: [string, Change][] = [
	["allowance revoked", ({ firm }) => revokeAllowance(firm.key)],
	[
		"allowance reduced",
		({ firm, agent }) => approveAllowance(firm.key, agent.publicKey, 100_000n),
	],
	["funds moved away", moveAllFunds],
];

describe("NEW-09 changed allowance or balance", () => {
	it.each(CHANGES)(
		"NEW-09 a prepared payment fails safely if allowance or balance changes before settlement (%s)",
		async (_name, change) => {
			const fixture = await autopayFirm(FirmSlot.AutopayChanged, 2_000_000n);
			try {
				const env = e2eEnv();
				const draft = draftOf(await postTask(fixture.mcp, ["es"]));
				const signature = await prepareAndSign(fixture, draft.draftId);
				await change(fixture);
				const wallet = fixture.firm.key.publicKey.toBase58();
				const before = await usdcOf(wallet);

				const reply = await fixture.mcp.call("pay_task", {
					draftId: draft.draftId,
					signature,
				});

				expect(reply.isError).toBe(true);
				expect(reply.text).toContain("payment failed");
				expect(reply.text).toContain("call prepare_payment again");
				expect(await usdcOf(wallet)).toBe(before);
				const status = await call(
					env.gatewayUrl,
					"GET",
					`/api/orders/draft/${draft.draftId}`,
				);
				expect(status.state).toBe("draft");
			} finally {
				await closeAutopay(fixture);
			}
		},
	);
});
