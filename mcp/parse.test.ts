import { describe, expect, test } from "vitest";
import {
	parseDraft,
	parseDraftStatus,
	parseOrder,
	parseTask,
} from "./parse.js";
import { AutopayStatus, DraftState, PublicState } from "./types.js";

const draft = {
	draftId: "drf_1",
	payUrl: "https://gateway.test/pay/drf_1",
	priceUnits: "1000000",
	totalUnits: "2000000",
	taskCount: 2,
	autopay: "available",
};
const status = {
	draftId: "drf_1",
	state: "draft",
	priceUnits: "1000000",
	totalUnits: "2000000",
	taskCount: 2,
	targetLangs: ["de", "fr"],
};
const task = {
	taskId: "tsk_de",
	targetLang: "de",
	publicState: "submitted",
	result: "Hallo",
	reason: null,
	claimDeadline: "2026-11-07T12:00:00.000Z",
	workDeadline: "2026-11-08T12:00:00.000Z",
};

describe("gateway response parsers", () => {
	test("parseDraft accepts the gateway draft; missing autopay is unknown", () => {
		expect(parseDraft(draft)).toEqual({
			ok: true,
			value: { ...draft, autopay: AutopayStatus.Available },
		});
		const { autopay: _autopay, ...older } = draft;
		expect(parseDraft(older)).toEqual({
			ok: true,
			value: { ...older, autopay: AutopayStatus.Unknown },
		});
	});

	test.each([
		["an invalid autopay value", { autopay: "maybe" }],
		["a null autopay", { autopay: null }],
		["a decimal price", { priceUnits: "1.5" }],
		["a negative total", { totalUnits: "-1" }],
		["a numeric price", { priceUnits: 1000000 }],
	])("parseDraft rejects %s", (_name, change) => {
		expect(parseDraft({ ...draft, ...change })).toEqual({
			ok: false,
			error: "gateway draft has an unexpected shape",
		});
	});

	test("parseDraftStatus keeps orderId and payUrl only when present", () => {
		const bare = parseDraftStatus(status);
		expect(bare).toEqual({
			ok: true,
			value: { ...status, state: DraftState.Draft },
		});
		expect(bare.ok && "orderId" in bare.value).toBe(false);
		expect(bare.ok && "payUrl" in bare.value).toBe(false);

		const full = {
			...status,
			state: "paid",
			orderId: "ord_1",
			payUrl: "https://gateway.test/pay/drf_1",
		};
		expect(parseDraftStatus(full)).toEqual({
			ok: true,
			value: { ...full, state: DraftState.Paid },
		});
		expect(parseDraftStatus({ ...status, orderId: 7 }).ok).toBe(false);
		expect(parseDraftStatus({ ...status, state: "expired" }).ok).toBe(false);
	});

	test("parseDraftStatus accepts orphaned with payTx and settling", () => {
		const orphaned = { ...status, state: "orphaned", payTx: "pay-tx-1" };
		expect(parseDraftStatus(orphaned)).toEqual({
			ok: true,
			value: { ...orphaned, state: DraftState.Orphaned },
		});
		expect(parseDraftStatus({ ...orphaned, payTx: null })).toEqual({
			ok: true,
			value: { ...orphaned, state: DraftState.Orphaned, payTx: null },
		});
		expect(parseDraftStatus({ ...orphaned, payTx: 7 }).ok).toBe(false);
		expect(parseDraftStatus({ ...status, state: "settling" })).toEqual({
			ok: true,
			value: { ...status, state: DraftState.Settling },
		});
	});

	test("parseOrder fails the whole order on an unknown public state", () => {
		expect(parseOrder({ orderId: "ord_1", tasks: [task] })).toEqual({
			ok: true,
			value: {
				orderId: "ord_1",
				tasks: [{ ...task, publicState: PublicState.Submitted }],
			},
		});
		expect(
			parseOrder({
				orderId: "ord_1",
				tasks: [task, { ...task, targetLang: "fr", publicState: "approved" }],
			}),
		).toEqual({ ok: false, error: "gateway order has an unexpected shape" });
	});

	test("parseTask requires claimDeadline and accepts null result, reason and workDeadline", () => {
		const nulls = { ...task, result: null, reason: null, workDeadline: null };
		expect(parseTask(nulls)).toEqual({
			ok: true,
			value: { ...nulls, publicState: PublicState.Submitted },
		});
		const { claimDeadline: _claim, ...noClaim } = task;
		expect(parseTask(noClaim)).toEqual({
			ok: false,
			error: "gateway task has an unexpected shape",
		});
		expect(parseTask({ ...task, claimDeadline: null }).ok).toBe(false);
	});
});
