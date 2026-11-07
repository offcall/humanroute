// EE-24: the MCP server needs a Bearer token and the gateway, not MCP, decides what it may do.
import { describe, expect, it } from "vitest";
import { e2eEnv } from "./support/env.js";
import { FirmSlot } from "./support/firms.js";
import { firmAt, team } from "./support/fixture.js";
import { call } from "./support/http.js";
import { connectMcp } from "./support/mcp.js";
import { draftOf, paidVia, postTask } from "./support/mcpFlow.js";
import { claim, submit, taskOf } from "./support/tasks.js";

const SEVEN_TOOLS = [
	"approve_task",
	"get_task",
	"pay_task",
	"post_task",
	"prepare_payment",
	"reject_task",
	"wait_task",
];

describe("MCP token", () => {
	it("EE-24 MCP needs a Bearer token and the gateway checks it", async () => {
		const res = await fetch(e2eEnv().mcpUrl, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json, text/event-stream",
			},
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
		});
		expect(res.status).toBe(401);

		const firm = await firmAt(FirmSlot.Mcp);
		const right = await connectMcp(firm.mcpToken);
		const wrong = await connectMcp("not-a-real-token");
		try {
			const { linguist } = await team();
			const unpaid = draftOf(await postTask(right, ["es"]));
			const { draft, tasks } = await paidVia(firm, right, ["de"]);
			const taskId = taskOf(tasks, "de").taskId;
			await claim(linguist.jar, taskId);
			await submit(linguist.jar, taskId);

			// Characterized: the token is not checked by MCP itself.
			expect((await wrong.tools()).sort()).toEqual(SEVEN_TOOLS);
			const read = await wrong.call("get_task", { draftId: unpaid.draftId });
			expect(read.isError).toBe(false);
			expect(read.text).toContain("state: draft");

			expect((await postTask(wrong, ["fr"])).isError).toBe(true);
			expect((await wrong.call("approve_task", { taskId })).isError).toBe(true);
			const paidRead = await wrong.call("get_task", { draftId: draft.draftId });
			expect(paidRead.isError).toBe(true);

			// The right token reaches the gateway as this firm's Bearer.
			expect(
				(await right.call("get_task", { draftId: draft.draftId })).isError,
			).toBe(false);
			const approved = await right.call("approve_task", { taskId });
			expect(approved.isError, approved.text).toBe(false);
			const task = await call(
				e2eEnv().gatewayUrl,
				"GET",
				`/api/tasks/${taskId}`,
				{ jar: firm.jar },
			);
			expect(task.state).toBe("approved");
		} finally {
			await right.close();
			await wrong.close();
		}
	});
});
