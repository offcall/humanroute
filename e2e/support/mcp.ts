// MCP client over Streamable HTTP with a Bearer token, plus post_task and its draft read back.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { e2eEnv } from "./env.js";
import { isRecord } from "./http.js";
import type { Draft } from "./orders.js";

export type ToolReply = { text: string; isError: boolean };

export type Mcp = {
	call: (name: string, args: Record<string, unknown>) => Promise<ToolReply>;
	tools: () => Promise<string[]>;
	close: () => Promise<void>;
};

const replyOf = (result: unknown): ToolReply => {
	const content = isRecord(result) ? result.content : undefined;
	const parts = Array.isArray(content) ? content : [];
	const text = parts
		.map((part) =>
			isRecord(part) && typeof part.text === "string" ? part.text : "",
		)
		.join("\n");
	return { text, isError: isRecord(result) && result.isError === true };
};

export const connectMcp = async (token: string): Promise<Mcp> => {
	const client = new Client({ name: "hr-e2e", version: "1.0.0" });
	const transport = new StreamableHTTPClientTransport(
		new URL(e2eEnv().mcpUrl),
		{ requestInit: { headers: { authorization: `Bearer ${token}` } } },
	);
	await client.connect(transport);
	return {
		call: async (name, args) =>
			replyOf(await client.callTool({ name, arguments: args })),
		tools: async () =>
			(await client.listTools()).tools.map((tool) => tool.name),
		close: () => client.close(),
	};
};

// Lines of the form "key: value" in a tool reply.
export const lineValue = (
	reply: ToolReply,
	key: string,
): string | undefined => {
	const line = reply.text
		.split("\n")
		.find((item) => item.toLowerCase().startsWith(`${key.toLowerCase()}:`));
	return line?.slice(key.length + 1).trim();
};

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
