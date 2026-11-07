import {
	decodeTransferCheckedInstruction,
	TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { describe, expect, test, vi } from "vitest";
import { Commitment } from "../config/index.js";
import { preparePayout } from "./prepare-payout.js";
import { ErrorKind, type PayoutLeg, type SolanaOptions } from "./types.js";

const hold = Keypair.fromSeed(new Uint8Array(32).fill(1));
const mint = Keypair.fromSeed(new Uint8Array(32).fill(9)).publicKey;
const wallet = Keypair.fromSeed(
	new Uint8Array(32).fill(5),
).publicKey.toBase58();
const pda = PublicKey.findProgramAddressSync(
	[Buffer.from("vault")],
	TOKEN_PROGRAM_ID,
)[0].toBase58();

const opts: SolanaOptions = {
	rpcUrl: "http://rpc.invalid",
	mint: mint.toBase58(),
	commitment: Commitment.Confirmed,
	hold,
};

// A Connection that never reaches the network: only getLatestBlockhash is scripted.
const stubConnection = (answer: () => Promise<unknown>) => {
	const conn = new Connection(opts.rpcUrl);
	const latest = vi
		.spyOn(conn, "getLatestBlockhash")
		.mockImplementation(async () => {
			await answer();
			return {
				blockhash: "11111111111111111111111111111111",
				lastValidBlockHeight: 77,
			};
		});
	return { conn, latest };
};

const prepare = (conn: Connection, legs: PayoutLeg[]) =>
	preparePayout(conn, opts, mint, { legs, memo: "hr:task-1" });

describe("preparePayout returns Final before any RPC for a PDA, malformed, negative or all-zero leg, and Retryable when the blockhash read fails", () => {
	test.each([
		["a PDA owner", [{ ownerWallet: pda, amountUnits: 1n }]],
		[
			"a non-base58 owner",
			[{ ownerWallet: "not-a-key-0OIl", amountUnits: 1n }],
		],
		[
			"a negative leg",
			[
				{ ownerWallet: wallet, amountUnits: 2n },
				{ ownerWallet: wallet, amountUnits: -1n },
			],
		],
		["all-zero legs", [{ ownerWallet: wallet, amountUnits: 0n }]],
	])("Final without RPC for %s", async (_name, legs) => {
		const { conn, latest } = stubConnection(async () => undefined);
		const result = await prepare(conn, legs);

		expect(result.ok).toBe(false);
		expect(result.ok ? null : result.error.kind).toBe(ErrorKind.Final);
		expect(latest).not.toHaveBeenCalled();
	});

	test("Retryable when the blockhash read fails", async () => {
		const { conn } = stubConnection(async () => {
			throw new Error("fetch failed");
		});
		const result = await prepare(conn, [
			{ ownerWallet: wallet, amountUnits: 1n },
		]);

		expect(result).toEqual({
			ok: false,
			error: { kind: ErrorKind.Retryable, message: "fetch failed" },
		});
	});

	test("binds the production 6 decimals and the fetched blockhash", async () => {
		const { conn, latest } = stubConnection(async () => undefined);
		const result = await prepare(conn, [
			{ ownerWallet: wallet, amountUnits: 500000n },
		]);
		if (!result.ok) {
			throw new Error(result.error.message);
		}

		expect(latest).toHaveBeenCalledWith(Commitment.Confirmed);
		expect(result.value.lastValidBlockHeight).toBe(77);
		const txn = Transaction.from(result.value.bytes);
		const transfers = txn.instructions
			.filter((ix) => ix.programId.equals(TOKEN_PROGRAM_ID))
			.map((ix) => decodeTransferCheckedInstruction(ix).data);
		expect(transfers).toEqual([
			expect.objectContaining({ amount: 500000n, decimals: 6 }),
		]);
	});
});
