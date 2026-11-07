import { afterEach, describe, expect, test, vi } from "vitest";
import { jsonResponse, nth, stubFetch } from "./fakes.js";
import { createGatewayClient } from "./gateway.js";

const BASE = "https://gateway.test";
const client = createGatewayClient(BASE);
const status = {
	draftId: "drf_1",
	state: "draft",
	priceUnits: "1000000",
	totalUnits: "2000000",
	taskCount: 1,
	targetLangs: ["de"],
};
const task = {
	taskId: "tsk_de",
	targetLang: "de",
	publicState: "paying_out",
	result: "Hallo",
	reason: null,
	claimDeadline: "2026-11-07T12:00:00.000Z",
	workDeadline: null,
};
const authOf = (init: RequestInit | undefined) =>
	new Headers(init?.headers).get("authorization");

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("gateway client", () => {
	test.each([
		[
			"a JSON 404 not_found",
			() => jsonResponse(404, { error: "not_found" }),
			{
				ok: false,
				error: "gateway returned HTTP 404: not_found",
				permanent: true,
			},
		],
		[
			"an HTML proxy 404",
			() => new Response("<html>404</html>", { status: 404 }),
			{ ok: false, error: "gateway returned HTTP 404" },
		],
		[
			"a 404 with another code",
			() => jsonResponse(404, { error: "route_missing" }),
			{ ok: false, error: "gateway returned HTTP 404: route_missing" },
		],
		[
			"an unexpected status",
			() => jsonResponse(503, { error: "unavailable" }),
			{ ok: false, error: "gateway returned HTTP 503: unavailable" },
		],
		[
			"a non-JSON expected body",
			() => new Response("ok", { status: 200 }),
			{ ok: false, error: "gateway returned a body that is not JSON" },
		],
	])(
		"distinguishes transient transport from permanent draft absence: %s",
		async (_name, response, expected) => {
			stubFetch(async () => response());

			expect(await client.getDraft("drf_1")).toEqual(expected);
		},
	);

	test.each([
		[
			"a timeout",
			new DOMException("timed out", "TimeoutError"),
			"gateway did not answer in 10 s",
		],
		[
			"a network error",
			new TypeError("fetch failed"),
			"gateway is unreachable",
		],
	])("reports %s as a transient failure", async (_name, thrown, error) => {
		const timeout = vi.spyOn(AbortSignal, "timeout");
		stubFetch(async () => {
			throw thrown;
		});

		expect(await client.getDraft("drf_1")).toEqual({ ok: false, error });
		expect(timeout).toHaveBeenCalledWith(10_000);
	});

	test("forwards the exact token on createDraft, getOrder, approve and reject, and none on getDraft", async () => {
		const token = "tok_Abc-123.xyz";
		const calls = stubFetch(async (url) => {
			if (url.endsWith("/api/orders/draft")) {
				return jsonResponse(201, {
					draftId: "drf_1",
					payUrl: "u",
					priceUnits: "1",
					totalUnits: "1",
					taskCount: 1,
				});
			}
			if (url.includes("/api/orders/draft/")) {
				return jsonResponse(200, status);
			}
			if (url.includes("/api/orders/")) {
				return jsonResponse(200, { orderId: "ord_1", tasks: [task] });
			}
			return jsonResponse(200, task);
		});

		expect(
			(
				await client.createDraft(token, {
					text: "t",
					sourceLang: "en",
					targets: [],
				})
			).ok,
		).toBe(true);
		expect((await client.getDraft("drf/1")).ok).toBe(true);
		expect((await client.getOrder(token, "ord_1")).ok).toBe(true);
		expect((await client.approveTask(token, "tsk_de")).ok).toBe(true);
		expect((await client.rejectTask(token, "tsk_de", "wrong dose")).ok).toBe(
			true,
		);

		expect(
			calls.map((call) => [call.init?.method, call.url, authOf(call.init)]),
		).toEqual([
			["POST", `${BASE}/api/orders/draft`, `Bearer ${token}`],
			["GET", `${BASE}/api/orders/draft/drf%2F1`, null],
			["GET", `${BASE}/api/orders/ord_1`, `Bearer ${token}`],
			["POST", `${BASE}/api/tasks/tsk_de/approve`, `Bearer ${token}`],
			["POST", `${BASE}/api/tasks/tsk_de/reject`, `Bearer ${token}`],
		]);
		expect(nth(calls, 4).init?.body).toBe(
			JSON.stringify({ reason: "wrong dose" }),
		);
	});
});
