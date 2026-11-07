// Auto-pay fixture (ADR 0036): a firm with an agent key from setup.mjs and an on-chain allowance,
// plus prepare_payment -> sign.mjs -> pay_task over the real MCP process.
import { getAccount } from "@solana/spl-token";
import { type AgentHome, approveAllowance, setupAgent } from "./agent.js";
import { ataOf } from "./chain.js";
import { connection } from "./env.js";
import { firmAt } from "./fixture.js";
import { connectMcp, type Mcp, type ToolReply } from "./mcp.js";
import type { Firm } from "./people.js";

export type AutopayFirm = { firm: Firm; mcp: Mcp; agent: AgentHome };

export const autopayFirm = async (
	slot: number,
	allowanceUnits: bigint,
): Promise<AutopayFirm> => {
	const firm = await firmAt(slot);
	const agent = await setupAgent(firm.key.publicKey.toBase58());
	if (allowanceUnits > 0n) {
		await approveAllowance(firm.key, agent.publicKey, allowanceUnits);
	}
	return { firm, mcp: await connectMcp(firm.mcpToken), agent };
};

export const closeAutopay = async (fixture: AutopayFirm): Promise<void> => {
	await fixture.mcp.close();
	fixture.agent.remove();
};

export const messageOf = (prepared: ToolReply): string =>
	/sign\.mjs (\S+)/.exec(prepared.text)?.[1] ?? "";

export const payTxOf = (reply: ToolReply): string =>
	/payTx ([1-9A-HJ-NP-Za-km-z]{64,90})/.exec(reply.text)?.[1] ?? "";

// prepare_payment, then sign.mjs on the printed message; throws if either refuses.
export const prepareAndSign = async (
	fixture: AutopayFirm,
	draftId: string,
): Promise<string> => {
	const prepared = await fixture.mcp.call("prepare_payment", { draftId });
	if (prepared.isError) {
		throw new Error(`prepare_payment refused: ${prepared.text}`);
	}
	const signed = await fixture.agent.sign(messageOf(prepared));
	if (signed.code !== 0) {
		throw new Error(`sign.mjs refused: ${signed.err}`);
	}
	return signed.out;
};

export const autopayPay = async (
	fixture: AutopayFirm,
	draftId: string,
): Promise<ToolReply> => {
	const signature = await prepareAndSign(fixture, draftId);
	return fixture.mcp.call("pay_task", { draftId, signature });
};

export const tokenAccount = (owner: string) =>
	getAccount(connection(), ataOf(owner), "confirmed");
