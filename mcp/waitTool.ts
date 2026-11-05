// wait_task: a long call that returns on the next change of a draft (ADR 0031).
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WAIT_TASK_DESCRIPTION } from "./descriptions.js";
import { toolText } from "./result.js";
import { readStatus } from "./status.js";
import {
	type GatewayClient,
	type WaitDeps,
	WaitKind,
	type WaitOutcome,
} from "./types.js";
import { waitForChange } from "./wait.js";

const NEXT = {
	[WaitKind.Changed]:
		"Changed. Report the change to the user. For a submitted language show its result and ask whether to approve or reject it. Then call wait_task again with this seen and end your turn.",
	[WaitKind.Settled]:
		"Every language is paid out or refunded. Do not call wait_task again for this draft.",
	[WaitKind.Cap]:
		"Nothing changed in 60 minutes. Call wait_task again with this seen.",
};

const reply = (outcome: WaitOutcome) => {
	switch (outcome.kind) {
		case WaitKind.Error:
			return toolText(
				`${outcome.message}\nIf the gateway was unreachable, call wait_task again with the last seen. A draft that is not found has expired.`,
				true,
			);
		case WaitKind.Aborted:
			return toolText("wait_task was stopped.");
		default:
			return toolText(
				[NEXT[outcome.kind], outcome.text, `seen: ${outcome.seen}`].join("\n"),
			);
	}
};

export const registerWaitTool = (
	server: McpServer,
	token: string,
	client: GatewayClient,
	deps: WaitDeps,
) => {
	server.registerTool(
		"wait_task",
		{
			description: WAIT_TASK_DESCRIPTION,
			inputSchema: {
				draftId: z.string().min(1),
				seen: z.string().min(1).optional(),
			},
		},
		async ({ draftId, seen }, extra) => {
			const progressToken = extra._meta?.progressToken;
			let progress = 0;
			const report = async (message: string) => {
				if (progressToken === undefined) {
					return;
				}
				progress += 1;
				await extra.sendNotification({
					method: "notifications/progress",
					params: { progressToken, progress, message },
				});
			};
			const outcome = await waitForChange({
				read: () => readStatus(client, token, draftId),
				seen,
				signal: extra.signal,
				report,
				deps,
			});

			return reply(outcome);
		},
	);
};
