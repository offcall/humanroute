import {
	parseDraft,
	parseDraftStatus,
	parseOrder,
	parseTask,
} from "./parse.js";
import type { GatewayClient, Parsed } from "./types.js";

// A hung gateway read must not stall wait_task past its progress notifications.
const TIMEOUT_MS = 10_000;

const call = async <T>(
	url: string,
	init: RequestInit,
	expected: number,
	parse: (body: unknown) => Parsed<T>,
): Promise<Parsed<T>> => {
	let response: Response;
	try {
		response = await fetch(url, {
			...init,
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
	} catch {
		return { ok: false, error: "gateway is unreachable" };
	}
	const body: unknown = await response.json().catch(() => undefined);
	if (response.status !== expected) {
		const code =
			typeof body === "object" && body !== null
				? Reflect.get(body, "error")
				: undefined;
		const detail = typeof code === "string" ? `: ${code}` : "";

		return {
			ok: false,
			error: `gateway returned HTTP ${response.status}${detail}`,
		};
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
	getDraft: (draftId) =>
		call(
			`${baseUrl}/api/orders/draft/${encodeURIComponent(draftId)}`,
			{ method: "GET" },
			200,
			parseDraftStatus,
		),
	getOrder: (token, orderId) =>
		call(
			`${baseUrl}/api/orders/${encodeURIComponent(orderId)}`,
			{ method: "GET", headers: { authorization: `Bearer ${token}` } },
			200,
			parseOrder,
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
