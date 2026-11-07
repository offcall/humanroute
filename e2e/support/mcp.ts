// MCP client over Streamable HTTP with a Bearer token: one connected client per token.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { e2eEnv } from "./env.js";
import { isRecord } from "./http.js";

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
