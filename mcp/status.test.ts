import { describe, expect, test } from "vitest";
import { draftStatus, orderTask, paidWith, unpaid } from "./fakes.js";
import {
	changesSince,
	fingerprint,
	isSettled,
	onlyTransient,
	progressLine,
} from "./status.js";
import { PublicState } from "./types.js";

const { Open, Claimed, Submitted, PayingOut, Refunding, PaidOut, Refunded } =
	PublicState;

describe("status", () => {
	test("fingerprint is the draft state before payment and paid;<lang>=<state> sorted by language after", () => {
		expect(fingerprint(unpaid())).toBe("draft");
		expect(
			fingerprint(paidWith(orderTask("fr", Open), orderTask("de", Claimed))),
		).toBe("paid;de=claimed;fr=open");
	});

	test("changesSince lists the order change and each moved language", () => {
		const snapshot = paidWith(orderTask("de", Claimed), orderTask("fr", Open));

		expect(changesSince("draft", snapshot)).toEqual([
			"order: draft -> paid",
			"de: awaiting payment -> claimed",
			"fr: awaiting payment -> open",
		]);
		expect(changesSince("paid;de=open;fr=open", snapshot)).toEqual([
			"de: open -> claimed",
		]);
		expect(changesSince("paid;de=claimed;fr=open", snapshot)).toEqual([]);
		expect(changesSince("draft", unpaid())).toEqual([]);
		// Malformed baselines: characterized, never thrown.
		expect(changesSince("", snapshot)).toEqual([
			"order:  -> paid",
			"de: awaiting payment -> claimed",
			"fr: awaiting payment -> open",
		]);
		expect(changesSince("paid;de;fr=open", snapshot)).toEqual([
			"de: awaiting payment -> claimed",
		]);
		expect(changesSince("paid;de=", snapshot)).toEqual([
			"de:  -> claimed",
			"fr: awaiting payment -> open",
		]);
	});

	test("onlyTransient is true only when every change ends in paying_out or refunding", () => {
		expect(onlyTransient([])).toBe(true);
		expect(
			onlyTransient(["de: submitted -> paying_out", "fr: open -> refunding"]),
		).toBe(true);
		expect(
			onlyTransient(["de: submitted -> paying_out", "fr: open -> claimed"]),
		).toBe(false);
		expect(onlyTransient(["order: draft -> paid"])).toBe(false);
		expect(onlyTransient(["de: paying_out -> paid_out"])).toBe(false);
	});

	test("isSettled is true only when every language is paid_out or refunded", () => {
		expect(isSettled(undefined)).toBe(false);
		expect(
			isSettled(
				paidWith(orderTask("de", PaidOut), orderTask("fr", Refunded)).order,
			),
		).toBe(true);
		expect(
			isSettled(
				paidWith(orderTask("de", PaidOut), orderTask("fr", Submitted)).order,
			),
		).toBe(false);
		expect(isSettled(paidWith(orderTask("de", PayingOut)).order)).toBe(false);
		expect(isSettled(paidWith(orderTask("de", Refunding)).order)).toBe(false);
		// Characterized: an order without tasks counts as settled.
		expect(isSettled(paidWith().order)).toBe(true);
	});

	test("progressLine shows the pay link while unpaid and the language states after", () => {
		expect(progressLine(unpaid())).toBe(
			"awaiting payment: https://gateway.test/pay/drf_1",
		);
		const { payUrl: _payUrl, ...noLink } = draftStatus();
		expect(progressLine({ status: noLink, order: undefined })).toBe(
			"awaiting payment",
		);
		expect(
			progressLine(paidWith(orderTask("de", Claimed), orderTask("fr", Open))),
		).toBe("de: claimed, fr: open");
	});
});
