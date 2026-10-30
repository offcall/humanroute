import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { GET_TASK_DESCRIPTION, POST_TASK_DESCRIPTION } from "./descriptions.js";
import { renderDraft, renderStatus } from "./render.js";
import type { GatewayClient } from "./types.js";

const targetSchema = z.object({
	targetLang: z.string().min(1),
	draft: z.string().min(1),
});

const postTaskShape = {
	text: z.string().min(1),
	sourceLang: z.string().min(1),
	targets: z
		.array(targetSchema)
		.min(1)
		.max(5)
		.refine(
			(targets) =>
				new Set(targets.map((target) => target.targetLang)).size ===
				targets.length,
			{ message: "targetLang values must be distinct" },
		),
};

const text = (value: string, isError = false): CallToolResult => ({
	content: [{ type: "text", text: value }],
	isError,
});

export const registerTools = (
	server: McpServer,
	token: string,
	client: GatewayClient,
) => {
	server.registerTool(
		"post_task",
		{ description: POST_TASK_DESCRIPTION, inputSchema: postTaskShape },
		async (input) => {
			const created = await client.createDraft(token, input);

			return created.ok
				? text(renderDraft(created.value))
				: text(created.error, true);
		},
	);

	server.registerTool(
		"get_task",
		{
			description: GET_TASK_DESCRIPTION,
			inputSchema: { draftId: z.string().min(1) },
		},
		async ({ draftId }) => {
			const status = await client.getDraft(draftId);
			if (!status.ok) {
				return text(status.error, true);
			}
			const { orderId } = status.value;
			if (orderId === undefined) {
				return text(renderStatus(status.value, undefined));
			}
			const order = await client.getOrder(token, orderId);

			return order.ok
				? text(renderStatus(status.value, order.value))
				: text(order.error, true);
		},
	);
};
