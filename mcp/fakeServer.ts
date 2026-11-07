// An MCP server and client linked in memory, so tests call the tools as Claude Code does.
// Imported only by mcp/*.test.ts.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVER_INSTRUCTIONS } from "./descriptions.js";

export const connectTools = async (register: (server: McpServer) => void) => {
	const server = new McpServer(
		{ name: "humanroute", version: "test" },
		{ instructions: SERVER_INSTRUCTIONS },
	);
	register(server);
	const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
	await server.connect(serverSide);
	const client = new Client({ name: "test", version: "test" });
	await client.connect(clientSide);
	return { client, server };
};

export type ToolReply = { text: string; isError: boolean };

// The single text block and error flag of a tool result.
export const replyOf = (result: unknown): ToolReply => {
	const content =
		typeof result === "object" && result !== null
			? Reflect.get(result, "content")
			: undefined;
	const first: unknown = Array.isArray(content) ? content[0] : undefined;
	const text =
		typeof first === "object" && first !== null
			? Reflect.get(first, "text")
			: undefined;
	if (typeof text !== "string") {
		throw new Error("tool result has no text block");
	}
	const isError =
		typeof result === "object" &&
		result !== null &&
		Reflect.get(result, "isError") === true;
	return { text, isError };
};

export const callTool = async (
	client: Client,
	name: string,
	args: Record<string, unknown>,
): Promise<ToolReply> =>
	replyOf(await client.callTool({ name, arguments: args }));
