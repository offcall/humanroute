// An MCP tool result with one text block.
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const toolText = (value: string, isError = false): CallToolResult => ({
	content: [{ type: "text", text: value }],
	isError,
});
