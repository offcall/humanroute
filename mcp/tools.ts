import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerDecisionTools } from "./decisionTools.js";
import { GET_TASK_DESCRIPTION, POST_TASK_DESCRIPTION } from "./descriptions.js";
import { renderDraft, renderStatus } from "./render.js";
import { toolText } from "./result.js";
import { readStatus } from "./status.js";
import type { GatewayClient, WaitDeps } from "./types.js";
import { registerWaitTool } from "./waitTool.js";

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

export const registerTools = (
	server: McpServer,
	token: string,
	client: GatewayClient,
	deps: WaitDeps,
) => {
	server.registerTool(
		"post_task",
		{ description: POST_TASK_DESCRIPTION, inputSchema: postTaskShape },
		async (input) => {
			const created = await client.createDraft(token, input);

			return created.ok
				? toolText(renderDraft(created.value))
				: toolText(created.error, true);
		},
	);

	server.registerTool(
		"get_task",
		{
			description: GET_TASK_DESCRIPTION,
			inputSchema: { draftId: z.string().min(1) },
		},
		async ({ draftId }) => {
			const current = await readStatus(client, token, draftId);

			return current.ok
				? toolText(renderStatus(current.value.status, current.value.order))
				: toolText(current.error, true);
		},
	);

	registerDecisionTools(server, token, client);
	registerWaitTool(server, token, client, deps);
};
