import {
	parseDraft,
	parseDraftStatus,
	parseOrder,
	parseTask,
} from "./parse.js";
import type { GatewayClient, Parsed } from "./types.js";

// A hung gateway read must not stall wait_task past its progress notifications.
const TIMEOUT_MS = 10_000;
const NOT_FOUND = 404;
// Only the gateway's own 404 means the draft is gone; a proxy 404 during a redeploy is retried.
const NOT_FOUND_CODE = "not_found";

const failure = (error: unknown): string =>
	error instanceof DOMException && error.name === "TimeoutError"
		? `gateway did not answer in ${TIMEOUT_MS / 1000} s`
		: "gateway is unreachable";

const call = async <T = unknown>(
	url: string,
	init: RequestInit,
	expected: number,
	parse: (body: unknown) => Parsed<T>,
	cancel?: AbortSignal,
): Promise<Parsed<T>> => {
	const timeout = AbortSignal.timeout(TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetch(url, {
			...init,
			signal:
				cancel === undefined ? timeout : AbortSignal.any([cancel, timeout]),
		});
	} catch (error) {
		return { ok: false, error: failure(error) };
	}
	const body: unknown = await response.json().catch(() => undefined);
	if (response.status !== expected) {
		const code =
			typeof body === "object" && body !== null
				? Reflect.get(body, "error")
				: undefined;
		const detail = typeof code === "string" ? `: ${code}` : "";

		const error = `gateway returned HTTP ${response.status}${detail}`;

		return response.status === NOT_FOUND && code === NOT_FOUND_CODE
			? { ok: false, error, permanent: true }
			: { ok: false, error };
	}
	if (body === undefined) {
		return { ok: false, error: "gateway returned a body that is not JSON" };
	}

	return parse(body);
};

export const createGatewayClient = (baseUrl: string): GatewayClient => ({
	createDraft: (token, input) =>
		call(
			`${baseUrl}/api/orders/draft`,
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(input),
			},
			201,
			parseDraft,
		),
	getDraft: (draftId, cancel) =>
		call(
			`${baseUrl}/api/orders/draft/${encodeURIComponent(draftId)}`,
			{ method: "GET" },
			200,
			parseDraftStatus,
			cancel,
		),
	getOrder: (token, orderId, cancel) =>
		call(
			`${baseUrl}/api/orders/${encodeURIComponent(orderId)}`,
			{ method: "GET", headers: { authorization: `Bearer ${token}` } },
			200,
			parseOrder,
			cancel,
		),
	approveTask: (token, taskId) =>
		call(
			`${baseUrl}/api/tasks/${encodeURIComponent(taskId)}/approve`,
			{ method: "POST", headers: { authorization: `Bearer ${token}` } },
			200,
			parseTask,
		),
	rejectTask: (token, taskId, reason) =>
		call(
			`${baseUrl}/api/tasks/${encodeURIComponent(taskId)}/reject`,
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ reason }),
			},
			200,
			parseTask,
		),
});
