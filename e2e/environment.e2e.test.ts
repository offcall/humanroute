// The localnet environment is a real offline payment network (ADR 0038, findings 7, 17).
import { readFileSync } from "node:fs";
import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { E2eMode } from "./env/types.js";
import { approveAllowance, setupAgent } from "./support/agent.js";
import { txFacts } from "./support/chain.js";
import { connection, e2eEnv, firmKey } from "./support/env.js";
import { FirmSlot } from "./support/firms.js";
import { call } from "./support/http.js";
import { connectMcp, type Mcp } from "./support/mcp.js";
import { createDraft, payDraft } from "./support/orders.js";
import { type Firm, registerFirm } from "./support/people.js";

const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const localnet = e2eEnv().mode === E2eMode.Localnet;

describe.runIf(localnet)("localnet environment", () => {
	let firm: Firm;
	let mcp: Mcp;

	beforeAll(async () => {
		firm = await registerFirm(
			e2eEnv().gatewayUrl,
			firmKey(FirmSlot.Environment),
		);
		mcp = await connectMcp(firm.mcpToken);
	});
	afterAll(async () => {
		await mcp?.close();
	});

	test("the local environment is a working offline payment network", async () => {
		const env = e2eEnv();
		expect(env.network).toBe(SOLANA_DEVNET);
		expect(new URL(env.rpcUrl).hostname).toBe("127.0.0.1");
		const mint = await getMint(connection(), new PublicKey(env.mint));
		expect(mint.decimals).toBe(6);
		const draftInfo = await call(
			env.gatewayUrl,
			"GET",
			`/api/orders/draft/${(await createDraft(firm.mcpToken, ["es"])).draftId}`,
		);
		expect(draftInfo.mint).toBe(env.mint);
		expect(draftInfo.network).toBe(SOLANA_DEVNET);

		// Plain x402 payment: the firm signs, the local facilitator verifies, pays the fee, settles.
		const wallet = firm.key.publicKey.toBase58();
		const plain = await createDraft(firm.mcpToken, ["es", "fr"]);
		const paid = await payDraft(firm.key, plain);
		const plainTx = await txFacts(paid.payTx);
		expect(plainTx.deltas.get(env.holdAddress)).toBe(plain.totalUnits);
		expect(plainTx.deltas.get(wallet)).toBe(-plain.totalUnits);
		expect(plainTx.payer).toBe(env.feePayer);

		// Delegated payment (ADR 0036): gateway builds, sign.mjs signs, MCP pays.
		const agent = await setupAgent(wallet);
		try {
			await approveAllowance(firm.key, agent.publicKey, 5_000_000n);
			const delegated = await createDraft(firm.mcpToken, ["de"]);
			const prepared = await mcp.call("prepare_payment", {
				draftId: delegated.draftId,
			});
			expect(prepared.isError, prepared.text).toBe(false);
			const message = /sign\.mjs (\S+)/.exec(prepared.text)?.[1] ?? "";
			const signed = await agent.sign(message);
			expect(signed.code, signed.err).toBe(0);
			const reply = await mcp.call("pay_task", {
				draftId: delegated.draftId,
				signature: signed.out,
			});
			expect(reply.isError, reply.text).toBe(false);
			const payTx = /\b([1-9A-HJ-NP-Za-km-z]{80,90})\b/.exec(reply.text)?.[1];
			expect(payTx, reply.text).toBeDefined();
			const facts = await txFacts(payTx ?? "");
			expect(facts.deltas.get(wallet)).toBe(-delegated.totalUnits);
			expect(facts.deltas.get(env.holdAddress)).toBe(delegated.totalUnits);
			expect(facts.payer).toBe(env.feePayer);
		} finally {
			agent.remove();
		}

		// No process of the run tried a non-loopback host.
		expect(readFileSync(env.egressLog ?? "", "utf8")).toBe("");
	});
});
