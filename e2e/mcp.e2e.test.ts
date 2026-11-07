// The MCP server as a real process: its HTTP boundary, the Bearer token and one real wake.
import { beforeAll, describe, expect, test } from "vitest";
import { e2eEnv } from "./support/env.js";
import { FirmSlot } from "./support/firms.js";
import { firmAt } from "./support/fixture.js";
import { connectMcp, draftOf, lineValue, postTask } from "./support/mcp.js";
import { payDraft } from "./support/orders.js";
import type { Firm } from "./support/people.js";

const LIMIT = 1_048_576;
const HEADERS = {
	"content-type": "application/json",
	accept: "application/json, text/event-stream",
	authorization: "Bearer any-token",
};

const post = (body: string, url = e2eEnv().mcpUrl) =>
	fetch(url, { method: "POST", headers: HEADERS, body });

// A tools/list request padded with spaces to exactly `size` bytes (still valid JSON).
const padded = (size: number): string => {
	const base = JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/list" });
	return `${base.slice(0, -1)}${" ".repeat(size - base.length)}}`;
};

const errorOf = async (res: Response): Promise<unknown> => {
	const body: unknown = await res.json().catch(() => undefined);
	return typeof body === "object" && body !== null
		? Reflect.get(body, "error")
		: undefined;
};

describe("MCP over the real gateway", () => {
	let firm: Firm;

	beforeAll(async () => {
		firm = await firmAt(FirmSlot.Mcp);
	});

	test("the MCP HTTP boundary rejects malformed and oversized bodies", async () => {
		const malformed = await post("{not json");
		expect(malformed.status).toBe(400);
		expect(await errorOf(malformed)).toBe("bad_request");

		const oversized = await post(padded(LIMIT + 1));
		expect(oversized.status).toBe(400);
		expect(await errorOf(oversized)).toBe("bad_request");

		const atLimit = await post(padded(LIMIT));
		expect(atLimit.status).toBe(200);
		await atLimit.text();

		const get = await fetch(e2eEnv().mcpUrl);
		expect(get.status).toBe(405);
		expect(get.headers.get("allow")).toBe("POST");
		const other = await post("{}", e2eEnv().mcpUrl.replace(/\/mcp$/, "/other"));
		expect(other.status).toBe(404);

		const later = await post(padded(200));
		expect(later.status).toBe(200);
		expect(await later.text()).toContain("post_task");
	});

	test("MCP needs a Bearer token and the gateway checks it", async () => {
		const res = await fetch(e2eEnv().mcpUrl, {
			method: "POST",
			headers: {
				"content-type": HEADERS["content-type"],
				accept: HEADERS.accept,
			},
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
		});
		expect(res.status).toBe(401);

		const right = await connectMcp(firm.mcpToken);
		const wrong = await connectMcp("not-a-real-token");
		try {
			const unpaid = draftOf(await postTask(right, ["es"]));
			expect(unpaid.payUrl).toBe(
				`${e2eEnv().gatewayUrl}/pay/${unpaid.draftId}`,
			);

			// Characterized: the token is not checked by MCP itself.
			expect((await wrong.tools()).length).toBe(7);
			const read = await wrong.call("get_task", { draftId: unpaid.draftId });
			expect(read.text).toContain("state: draft");
			expect((await postTask(wrong, ["fr"])).isError).toBe(true);
		} finally {
			await right.close();
			await wrong.close();
		}
	});

	test("wait_task wakes on a real payment with the changes line", async () => {
		const mcp = await connectMcp(firm.mcpToken);
		try {
			const draft = draftOf(await postTask(mcp, ["fr"]));
			const onPay = mcp.call("wait_task", {
				draftId: draft.draftId,
				seen: "draft",
			});
			await payDraft(firm.key, draft);
			const woke = await onPay;

			expect(lineValue(woke, "changes")).toBe(
				"order: draft -> paid; fr: awaiting payment -> open",
			);
			expect(lineValue(woke, "seen")).toBe("paid;fr=open");
		} finally {
			await mcp.close();
		}
	});
});
