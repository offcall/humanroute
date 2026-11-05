// Agent auto-pay tools (ADR 0036): prepare_payment builds the unsigned delegate payment, the agent
// signs it locally with sign.mjs, pay_task sends the x402 payment.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
	PAY_TASK_DESCRIPTION,
	PREPARE_PAYMENT_DESCRIPTION,
} from "./descriptions.js";
import { pay } from "./payTool.js";
import type { PayClient } from "./payTypes.js";
import { prepare } from "./prepareTool.js";

export const registerPayTools = (
	server: McpServer,
	token: string,
	payClient: PayClient,
	now: () => number,
) => {
	server.registerTool(
		"prepare_payment",
		{
			description: PREPARE_PAYMENT_DESCRIPTION,
			inputSchema: { draftId: z.string().min(1) },
		},
		async ({ draftId }) => prepare(payClient, token, draftId, now()),
	);
	server.registerTool(
		"pay_task",
		{
			description: PAY_TASK_DESCRIPTION,
			inputSchema: { draftId: z.string().min(1), signature: z.string().min(1) },
		},
		async ({ draftId, signature }) =>
			pay(payClient, token, draftId, signature, now()),
	);
};
