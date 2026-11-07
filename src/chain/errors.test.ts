import { describe, expect, test } from "vitest";
import { classify } from "./errors.js";
import { ErrorKind, Phase } from "./types.js";

const { Retryable, Final, Ambiguous } = ErrorKind;

describe("classifies chain errors by phase", () => {
	test.each([
		["HTTP 429", "429 Too Many Requests", Retryable, Retryable],
		["too many requests", "too many requests", Retryable, Retryable],
		["Blockhash not found", "Blockhash not found", Retryable, Retryable],
		["BlockhashNotFound", "BlockhashNotFound", Retryable, Retryable],
		["blockhash notfound", "blockhash notfound", Retryable, Retryable],
		["insufficient funds", "insufficient funds for rent", Final, Final],
		["insufficient lamports", "insufficient lamports 5, need 10", Final, Final],
		["0x1", "custom program error: 0x1", Final, Final],
		["account not found", "AccountNotFound", Final, Final],
		["could not find account", "could not find account", Final, Final],
		[
			"invalid account data",
			"invalid account data for instruction",
			Final,
			Final,
		],
		["0x10 is not 0x1", "custom program error: 0x10", Retryable, Ambiguous],
		[
			"simulation failed",
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
		["unknown", "something odd", Retryable, Ambiguous],
		["timeout", "request timed out after 30000ms", Retryable, Ambiguous],
		["ETIMEDOUT", "connect ETIMEDOUT 1.2.3.4:443", Retryable, Ambiguous],
		["connection reset", "socket hang up ECONNRESET", Retryable, Ambiguous],
		["5xx", "502 Bad Gateway", Retryable, Ambiguous],
	])("%s: %s", (_name, message, prepare, sendKind) => {
		expect(classify(new Error(message), Phase.Prepare).kind).toBe(prepare);
		expect(classify(new Error(message), Phase.Send).kind).toBe(sendKind);
	});
});

describe("keeps at most 500 characters and reads Error and string values", () => {
	test.each([
		["an Error", new Error("boom"), "boom"],
		["a string", "plain text", "plain text"],
		["an object", { message: "hidden" }, "unknown error"],
		["null", null, "unknown error"],
	])("reads %s", (_name, value, message) => {
		expect(classify(value, Phase.Prepare).message).toBe(message);
	});

	test("truncates to exactly 500 characters", () => {
		const long = "x".repeat(501);
		expect(classify(long, Phase.Prepare).message).toBe("x".repeat(500));
		expect(classify("y".repeat(500), Phase.Prepare).message).toHaveLength(500);
	});
});
