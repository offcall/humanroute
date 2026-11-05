// approve_task and reject_task: the firm's decision, recorded only after Claude asked the user (ADR 0030).
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	APPROVE_TASK_DESCRIPTION,
	REJECT_TASK_DESCRIPTION,
} from "./descriptions.js";
import { renderDecision } from "./render.js";
import { toolText } from "./result.js";
import type { GatewayClient, OrderTask, Parsed } from "./types.js";

// The gateway's reject reason limit (src/tasks/body.ts, ADR 0023); mcp/ cannot import src/ values.
const MAX_REASON_LENGTH = 1000;

// A lost answer may hide a recorded decision; a second call would only get 409 bad_state.
const CHECK_FIRST =
	"Call get_task and check this language's state before retrying.";

const reply = (decided: Parsed<OrderTask>) =>
	decided.ok
		? toolText(renderDecision(decided.value))
		: toolText(`${decided.error}\n${CHECK_FIRST}`, true);

export const registerDecisionTools = (
	server: McpServer,
	token: string,
	client: GatewayClient,
) => {
	server.registerTool(
		"approve_task",
		{
			description: APPROVE_TASK_DESCRIPTION,
			inputSchema: { taskId: z.string().min(1) },
		},
		async ({ taskId }) => reply(await client.approveTask(token, taskId)),
	);

	server.registerTool(
		"reject_task",
		{
			description: REJECT_TASK_DESCRIPTION,
			inputSchema: {
				taskId: z.string().min(1),
				reason: z.string().trim().min(1).max(MAX_REASON_LENGTH),
			},
		},
		async ({ taskId, reason }) =>
			reply(await client.rejectTask(token, taskId, reason)),
	);
};
