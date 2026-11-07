// The MCP HTTP boundary (mcp/index.ts) on the real process: body limit, JSON, methods, paths.
import { describe, expect, test } from "vitest";
import { e2eEnv } from "./support/env.js";

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

describe("MCP HTTP boundary", () => {
	test("the MCP HTTP boundary rejects malformed and oversized bodies", async () => {
		const malformed = await post("{not json");
		expect(malformed.status).toBe(400);
		expect(await errorOf(malformed)).toBe("bad_request");

		const oversized = await post(padded(LIMIT + 1));
		expect(oversized.status).toBe(400);
		expect(await errorOf(oversized)).toBe("bad_request");

		const atLimit = await post(padded(LIMIT));
		expect(Buffer.byteLength(padded(LIMIT))).toBe(LIMIT);
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
});
