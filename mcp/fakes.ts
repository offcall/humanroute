// MCP test support (ADR 0037): a scriptable GatewayClient, a hand-moved wait clock, a fetch stub
// and gateway snapshots. Imported only by mcp/*.test.ts.
import { vi } from "vitest";
import {
	DraftState,
	type DraftStatus,
	type GatewayClient,
	type Order,
	type OrderTask,
	type Parsed,
	type PublicState,
	type Snapshot,
	type WaitDeps,
} from "./types.js";

export type GatewayCall = { method: string; args: unknown[] };

const unexpected = (method: string) => async (): Promise<Parsed<never>> => {
	throw new Error(`unexpected gateway call: ${method}`);
};

// Every call is recorded; a method not scripted fails the test.
export const fakeGateway = (script: Partial<GatewayClient> = {}) => {
	const calls: GatewayCall[] = [];
	const client: GatewayClient = {
		createDraft: async (...args) => {
			calls.push({ method: "createDraft", args });
			return (script.createDraft ?? unexpected("createDraft"))(...args);
		},
		getDraft: async (...args) => {
			calls.push({ method: "getDraft", args });
			return (script.getDraft ?? unexpected("getDraft"))(...args);
		},
		getOrder: async (...args) => {
			calls.push({ method: "getOrder", args });
			return (script.getOrder ?? unexpected("getOrder"))(...args);
		},
		approveTask: async (...args) => {
			calls.push({ method: "approveTask", args });
			return (script.approveTask ?? unexpected("approveTask"))(...args);
		},
		rejectTask: async (...args) => {
			calls.push({ method: "rejectTask", args });
			return (script.rejectTask ?? unexpected("rejectTask"))(...args);
		},
	};
	return { client, calls };
};

// sleep advances the clock by its duration at once; an aborted signal leaves the clock alone.
export const fakeWaitClock = (start = 0) => {
	let current = start;
	const sleeps: number[] = [];
	const deps: WaitDeps = {
		now: () => current,
		sleep: async (millis, signal) => {
			sleeps.push(millis);
			if (!signal.aborted) {
				current += millis;
			}
		},
	};
	const advance = (millis: number) => {
		current += millis;
	};
	return { deps, sleeps, advance };
};

export type FetchCall = { url: string; init: RequestInit | undefined };

// Replaces global fetch; call vi.unstubAllGlobals() after each test.
export const stubFetch = (
	answer: (url: string, init: RequestInit | undefined) => Promise<Response>,
) => {
	const calls: FetchCall[] = [];
	vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
		calls.push({ url: input, init });
		return answer(input, init);
	});
	return calls;
};

export const jsonResponse = (
	status: number,
	body: unknown,
	headers: Record<string, string> = {},
) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", ...headers },
	});

export const draftStatus = (extra: Partial<DraftStatus> = {}): DraftStatus => ({
	draftId: "drf_1",
	state: DraftState.Draft,
	payUrl: "https://gateway.test/pay/drf_1",
	priceUnits: "1000000",
	totalUnits: "2000000",
	taskCount: 2,
	targetLangs: ["de", "fr"],
	...extra,
});

export const orderTask = (
	targetLang: string,
	publicState: PublicState,
	extra: Partial<OrderTask> = {},
): OrderTask => ({
	taskId: `tsk_${targetLang}`,
	targetLang,
	publicState,
	result: null,
	reason: null,
	claimDeadline: "2026-11-07T12:00:00.000Z",
	workDeadline: null,
	...extra,
});

export const unpaid = (): Snapshot => ({
	status: draftStatus(),
	order: undefined,
});

export const paidWith = (...tasks: OrderTask[]): Snapshot => {
	const order: Order = { orderId: "ord_1", tasks };
	return {
		status: draftStatus({ state: DraftState.Paid, orderId: order.orderId }),
		order,
	};
};

// The item at index; a missing one fails the test.
export const nth = <T = unknown>(items: readonly T[], index: number): T => {
	const item = items[index];
	if (item === undefined) {
		throw new Error(`no item at index ${index}`);
	}
	return item;
};
