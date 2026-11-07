// MCP-driven order steps: post_task, the draft read back from its text, and a paid order.
import { lineValue, type Mcp, type ToolReply } from "./mcp.js";
import { type Draft, type Paid, payDraft } from "./orders.js";
import type { Firm } from "./people.js";
import { orderTasks, type TaskState } from "./tasks.js";

export const postTask = (mcp: Mcp, langs: string[]): Promise<ToolReply> =>
	mcp.call("post_task", {
		text: "Keep out of reach of children.",
		sourceLang: "en",
		targets: langs.map((targetLang) => ({
			targetLang,
			draft: `(${targetLang})`,
		})),
	});

// "Total: 1.000000 USDC" -> base units.
export const draftOf = (reply: ToolReply): Draft => {
	const total = /Total: (\d+)\.(\d+) USDC/.exec(reply.text);
	const whole = BigInt(total?.[1] ?? "0");
	const fraction = BigInt((total?.[2] ?? "").padEnd(6, "0").slice(0, 6));
	return {
		draftId: lineValue(reply, "draftId") ?? "",
		totalUnits: whole * 1_000_000n + fraction,
		payUrl: lineValue(reply, "Pay link") ?? "",
	};
};

export type McpOrder = { draft: Draft; paid: Paid; tasks: TaskState[] };

export const paidVia = async (
	firm: Firm,
	mcp: Mcp,
	langs: string[],
): Promise<McpOrder> => {
	const draft = draftOf(await postTask(mcp, langs));
	const paid = await payDraft(firm.key, draft);
	const tasks = await orderTasks(firm.jar, paid.orderId);
	return { draft, paid, tasks };
};
