import {
	Connection,
	type SignatureStatus as RawStatus,
	type TransactionConfirmationStatus,
} from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { Commitment } from "../config/index.js";
import { blockHeight, signatureStatus } from "./status.js";
import { ErrorKind } from "./types.js";

const raw = (
	confirmationStatus: TransactionConfirmationStatus,
	err: RawStatus["err"] = null,
): RawStatus => ({ slot: 9, confirmations: 1, err, confirmationStatus });

const stub = (value: RawStatus | null) => {
	const conn = new Connection("http://rpc.invalid");
	const lookup = vi
		.spyOn(conn, "getSignatureStatuses")
		.mockResolvedValue({ context: { slot: 9 }, value: [value] });
	return { conn, lookup };
};

describe("NEW-01 uses transaction history and maps raw RPC status at the configured commitment", () => {
	it.each([
		["null", null, Commitment.Confirmed, { state: "unknown" }],
		[
			"an on-chain error",
			raw("confirmed", { InstructionError: [0, "Custom"] }),
			Commitment.Confirmed,
			{ state: "failed", error: '{"InstructionError":[0,"Custom"]}' },
		],
		["processed", raw("processed"), Commitment.Confirmed, { state: "pending" }],
		[
			"confirmed",
			raw("confirmed"),
			Commitment.Confirmed,
			{ state: "confirmed" },
		],
		[
			"finalized",
			raw("finalized"),
			Commitment.Confirmed,
			{ state: "confirmed" },
		],
		[
			"confirmed under Finalized",
			raw("confirmed"),
			Commitment.Finalized,
			{ state: "pending" },
		],
		[
			"finalized under Finalized",
			raw("finalized"),
			Commitment.Finalized,
			{ state: "confirmed" },
		],
	])("maps %s", async (_name, value, commitment, expected) => {
		const { conn, lookup } = stub(value);

		expect(await signatureStatus(conn, "sig-1", commitment)).toEqual({
			ok: true,
			value: expected,
		});
		expect(lookup).toHaveBeenCalledWith(["sig-1"], {
			searchTransactionHistory: true,
		});
	});

	it("classifies lookup errors in the Prepare phase", async () => {
		const conn = new Connection("http://rpc.invalid");
		vi.spyOn(conn, "getSignatureStatuses").mockRejectedValue(
			new Error("request timed out"),
		);
		vi.spyOn(conn, "getBlockHeight").mockRejectedValue(
			new Error("socket hang up"),
		);

		const status = await signatureStatus(conn, "sig-1", Commitment.Confirmed);
		expect(status).toEqual({
			ok: false,
			error: { kind: ErrorKind.Retryable, message: "request timed out" },
		});
		const height = await blockHeight(conn, Commitment.Confirmed);
		expect(height).toEqual({
			ok: false,
			error: { kind: ErrorKind.Retryable, message: "socket hang up" },
		});
	});
});
