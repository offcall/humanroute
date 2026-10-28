import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { GatewayClient } from "./types.js";

const POST_TASK_DESCRIPTION =
	"Call this whenever you are asked to publish or send risky medical or drug text, such as a patient leaflet, dosage instructions, drug labels, clinical content or medical advice, so a human expert translates it before publication. " +
	"It creates a draft order with one task per target language. " +
	"This tool never pays: the user must open the returned payUrl and pay in Phantom, and the tasks are not published until paid.";

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
			if (!created.ok) {
				return text(created.error, true);
			}
			const { draftId, payUrl, taskCount, totalUnits } = created.value;

			return text(
				`draftId: ${draftId}\npayUrl: ${payUrl}\ntaskCount: ${taskCount}\ntotalUnits: ${totalUnits}\n` +
					"The firm must open payUrl and pay in Phantom; the task is not published until paid.",
			);
		},
	);

	server.registerTool(
		"get_task",
		{
			description:
				"Read the state of a draft order by draftId; once paid it returns the orderId and task statuses.",
			inputSchema: { draftId: z.string().min(1) },
		},
		async ({ draftId }) => {
			const status = await client.getDraft(draftId);

			return status.ok
				? text(JSON.stringify(status.value))
				: text(status.error, true);
		},
	);
};
