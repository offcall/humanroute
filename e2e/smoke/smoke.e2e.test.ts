// Read-only smoke of a running target (ADR 0038), no setup: SMOKE_GATEWAY_URL (required),
// SMOKE_MCP_URL and SMOKE_MCP_TOKEN (operator-supplied, for the tool list). GET only on the
// gateway; nothing is created, paid or changed. Skipped when SMOKE_GATEWAY_URL is not set.
import { describe, expect, it } from "vitest";

const gateway = (process.env.SMOKE_GATEWAY_URL ?? "").replace(/\/$/, "");
const mcpUrl = process.env.SMOKE_MCP_URL ?? "";
const mcpToken = process.env.SMOKE_MCP_TOKEN ?? "";
const MCP_ACCEPT = "application/json, text/event-stream";

const json = async (res: Response): Promise<Record<string, unknown>> => {
	const body: unknown = await res.json();
	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		throw new Error(`not a JSON object from ${res.url}`);
	}
	return Object.fromEntries(Object.entries(body));
};

const mcpPost = (body: unknown, token?: string) =>
	fetch(mcpUrl, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: MCP_ACCEPT,
			...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
		},
		body: JSON.stringify(body),
	});

describe.runIf(gateway !== "")("smoke", () => {
	it("EE-40 /health answers ready true", async () => {
		const res = await fetch(`${gateway}/health`);
		expect(res.status).toBe(200);
		expect(await json(res)).toEqual({ ok: true, ready: true });
	});

	it.runIf(mcpUrl !== "")(
		"EE-41 /mcp answers 401 to POST without a token, 405 to GET, 404 on other paths, and lists seven tools with a token",
		async () => {
			const list = { jsonrpc: "2.0", id: 1, method: "tools/list" };
			expect((await mcpPost(list)).status).toBe(401);
			const get = await fetch(mcpUrl);
			expect(get.status).toBe(405);
			expect(get.headers.get("allow")).toBe("POST");
			expect((await fetch(new URL("/other", mcpUrl))).status).toBe(404);
			if (mcpToken === "") {
				return;
			}
			const tools = await mcpPost(list, mcpToken);
			expect(tools.status).toBe(200);
			const text = await tools.text();
			for (const name of [
				"post_task",
				"get_task",
				"wait_task",
				"approve_task",
				"reject_task",
				"prepare_payment",
				"pay_task",
			]) {
				expect(text).toContain(`"${name}"`);
			}
		},
	);

	it("EE-42 the SPA is served for / and client routes and discovered assets load with their MIME types", async () => {
		const index = await fetch(`${gateway}/`);
		expect(index.status).toBe(200);
		expect(index.headers.get("content-type")).toContain("text/html");
		const html = await index.text();
		const route = await fetch(`${gateway}/join/smoke-code`);
		expect(route.headers.get("content-type")).toContain("text/html");
		expect(await route.text()).toBe(html);

		const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
			(match) => match[1] ?? "",
		);
		expect(assets.length).toBeGreaterThan(0);
		for (const path of assets) {
			const res = await fetch(`${gateway}${path}`);
			expect(res.status, path).toBe(200);
			const type = res.headers.get("content-type") ?? "";
			expect(type, path).toContain(
				path.endsWith(".css") ? "text/css" : "text/javascript",
			);
		}
		const missing = await fetch(`${gateway}/assets/missing-smoke-chunk.js`);
		expect(missing.headers.get("content-type") ?? "").not.toContain(
			"text/html",
		);
		expect(missing.status).toBe(404);
	});

	it("EE-43 unknown GET /api and /x paths answer 404 JSON and an unknown draft answers 404 not_found", async () => {
		for (const path of ["/api/smoke-unknown", "/x/smoke-unknown"]) {
			const res = await fetch(`${gateway}${path}`);
			expect(res.status, path).toBe(404);
			expect(await json(res)).toEqual({ error: "not_found" });
		}
		const draft = await fetch(
			`${gateway}/api/orders/draft/00000000-0000-4000-8000-000000000000`,
		);
		expect(draft.status).toBe(404);
		expect(await json(draft)).toEqual({ error: "not_found" });
	});
});
