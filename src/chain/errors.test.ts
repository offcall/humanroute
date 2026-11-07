import { describe, expect, it } from "vitest";
import { classify } from "./errors.js";
import { ErrorKind, Phase } from "./types.js";

const { Retryable, Final, Ambiguous } = ErrorKind;

describe("CH-01T classifies chain errors by phase", () => {
	it.each([
		["CH-01 HTTP 429", "429 Too Many Requests", Retryable, Retryable],
		["CH-01 too many requests", "too many requests", Retryable, Retryable],
		["CH-02 Blockhash not found", "Blockhash not found", Retryable, Retryable],
		["CH-02 BlockhashNotFound", "BlockhashNotFound", Retryable, Retryable],
		["CH-02 blockhash notfound", "blockhash notfound", Retryable, Retryable],
		["CH-03 insufficient funds", "insufficient funds for rent", Final, Final],
		[
			"CH-03 insufficient lamports",
			"insufficient lamports 5, need 10",
			Final,
			Final,
		],
		["CH-03 0x1", "custom program error: 0x1", Final, Final],
		["CH-03 account not found", "AccountNotFound", Final, Final],
		["CH-03 could not find account", "could not find account", Final, Final],
		[
			"CH-03 invalid account data",
			"invalid account data for instruction",
			Final,
			Final,
		],
		[
			"CH-03 0x10 is not 0x1",
			"custom program error: 0x10",
			Retryable,
			Ambiguous,
		],
		[
			"CH-04 simulation failed",
			"Transaction simulation failed: Error processing Instruction 0",
			Retryable,
			Final,
		],
		[
			"blockhash wins over simulation failed",
			"Transaction simulation failed: Blockhash not found",
			Retryable,
			Retryable,
		],
		["CH-05/06 unknown", "something odd", Retryable, Ambiguous],
		["CH-06 timeout", "request timed out after 30000ms", Retryable, Ambiguous],
		["CH-06 ETIMEDOUT", "connect ETIMEDOUT 1.2.3.4:443", Retryable, Ambiguous],
		[
			"CH-06 connection reset",
			"socket hang up ECONNRESET",
			Retryable,
			Ambiguous,
		],
		["CH-06 5xx", "502 Bad Gateway", Retryable, Ambiguous],
	])("%s: %s", (_name, message, prepare, sendKind) => {
		expect(classify(new Error(message), Phase.Prepare).kind).toBe(prepare);
		expect(classify(new Error(message), Phase.Send).kind).toBe(sendKind);
	});
});

describe("CH-07 keeps at most 500 characters and reads Error and string values", () => {
	it.each([
		["an Error", new Error("boom"), "boom"],
		["a string", "plain text", "plain text"],
		["an object", { message: "hidden" }, "unknown error"],
		["null", null, "unknown error"],
	])("reads %s", (_name, value, message) => {
		expect(classify(value, Phase.Prepare).message).toBe(message);
	});

	it("truncates to exactly 500 characters", () => {
		const long = "x".repeat(501);
		expect(classify(long, Phase.Prepare).message).toBe("x".repeat(500));
		expect(classify("y".repeat(500), Phase.Prepare).message).toHaveLength(500);
	});
});
