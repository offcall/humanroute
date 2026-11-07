import { base58 } from "@scure/base";
import {
	ASSOCIATED_TOKEN_PROGRAM_ID,
	decodeTransferCheckedInstruction,
	getAssociatedTokenAddressSync,
	TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { describe, expect, test } from "vitest";
import { MEMO_PROGRAM_ID, signPayout } from "./payout.js";
import type { PayoutLeg, TransferParams } from "./types.js";

const seeded = (byte: number): Keypair =>
	Keypair.fromSeed(new Uint8Array(32).fill(byte));

const hold = seeded(1);
const linguist = seeded(5).publicKey.toBase58();
const agency = seeded(4).publicKey.toBase58();
const fee = seeded(2).publicKey.toBase58();
const mint = seeded(9).publicKey;

const params: TransferParams = {
	hold,
	mint,
	decimals: 6,
	blockhash: "11111111111111111111111111111111",
	lastValidBlockHeight: 4242,
};

const legsOf = (units: bigint[], wallets = [linguist, agency, fee]) =>
	units.map(
		(amountUnits, index): PayoutLeg => ({
			ownerWallet: wallets[index] ?? linguist,
			amountUnits,
		}),
	);

const sign = (legs: PayoutLeg[], memo = "hr:task-1") =>
	signPayout(params, { legs, memo });

const decode = (bytes: Uint8Array) => Transaction.from(bytes);

const transfersOf = (txn: Transaction) =>
	txn.instructions
		.filter((ix) => ix.programId.equals(TOKEN_PROGRAM_ID))
		.map((ix) => decodeTransferCheckedInstruction(ix));

const ataOf = (owner: string | PublicKey) =>
	getAssociatedTokenAddressSync(mint, new PublicKey(owner));

describe("payout transaction", () => {
	test("builds idempotent ATA creation for every recipient, then one TransferChecked per leg, then the memo last", () => {
		const memo = "hr:task-1 — ünïcödé ✓";
		const txn = decode(sign(legsOf([400000n, 90000n, 10000n]), memo).bytes);
		const kinds = txn.instructions.map((ix) => {
			if (ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
				return `ata:${ix.data[0]}`;
			}
			return ix.programId.equals(MEMO_PROGRAM_ID)
				? "memo"
				: `token:${ix.data[0]}`;
		});
		expect(kinds).toEqual([
			"ata:1",
			"ata:1",
			"ata:1",
			"token:12",
			"token:12",
			"token:12",
			"memo",
		]);

		const atas = txn.instructions.slice(0, 3).map((ix) => ix.keys[1]?.pubkey);
		expect(atas).toEqual([ataOf(linguist), ataOf(agency), ataOf(fee)]);

		const memoIx = txn.instructions.at(-1);
		expect(Buffer.from(memoIx?.data ?? []).toString("utf8")).toBe(memo);
		// The hold signs the memo; it is writable only because it is also the fee payer.
		expect(memoIx?.keys.map((key) => [key.pubkey, key.isSigner])).toEqual([
			[hold.publicKey, true],
		]);
	});

	test("transfers each leg's exact amount from the hold ATA with the hold as authority", () => {
		const units = [400001n, 89999n, 10000n];
		const transfers = transfersOf(decode(sign(legsOf(units)).bytes));

		expect(transfers.map((ix) => ix.data.amount)).toEqual(units);
		expect(transfers.map((ix) => ix.data.decimals)).toEqual([6, 6, 6]);
		for (const ix of transfers) {
			expect(ix.keys.source.pubkey).toEqual(ataOf(hold.publicKey));
			expect(ix.keys.mint.pubkey).toEqual(mint);
			expect(ix.keys.owner.pubkey).toEqual(hold.publicKey);
		}
		expect(transfers.map((ix) => ix.keys.destination.pubkey)).toEqual([
			ataOf(linguist),
			ataOf(agency),
			ataOf(fee),
		]);
	});

	test("makes the hold the fee payer and only signer and returns its base58 signature, blockhash and last valid height", () => {
		const signed = sign(legsOf([500000n]));
		const txn = decode(signed.bytes);

		expect(txn.feePayer).toEqual(hold.publicKey);
		expect(txn.signatures.map((entry) => entry.publicKey)).toEqual([
			hold.publicKey,
		]);
		expect(txn.verifySignatures()).toBe(true);
		const first = txn.signatures[0]?.signature;
		expect(first).not.toBeNull();
		expect(signed.signature).toBe(base58.encode(first ?? new Uint8Array()));
		expect(signed.blockhash).toBe(params.blockhash);
		expect(txn.recentBlockhash).toBe(params.blockhash);
		expect(signed.lastValidBlockHeight).toBe(4242);
	});

	test("skips zero legs and throws on a negative leg or when every leg is zero", () => {
		const txn = decode(sign(legsOf([500000n, 0n, 0n])).bytes);
		expect(transfersOf(txn).map((ix) => ix.data.amount)).toEqual([500000n]);
		expect(txn.instructions).toHaveLength(3);

		expect(() => sign(legsOf([500001n, -1n]))).toThrow(/negative/);
		expect(() => sign(legsOf([0n, 0n]))).toThrow(/non-zero/);
	});

	test.each([
		["linguist = agency", [linguist, linguist, fee]],
		["every recipient the same wallet", [fee, fee, fee]],
		["recipient = hold", [hold.publicKey.toBase58(), agency, fee]],
	])(
		"coincident recipient wallets conserve the entire split in one signed transaction (%s)",
		(_name, wallets) => {
			const units = [400000n, 90000n, 10000n];
			const txn = decode(sign(legsOf(units, wallets)).bytes);
			const transfers = transfersOf(txn);

			expect(transfers.reduce((sum, ix) => sum + ix.data.amount, 0n)).toBe(
				500000n,
			);
			expect(transfers.map((ix) => ix.keys.destination.pubkey)).toEqual(
				wallets.map(ataOf),
			);
			for (const ix of transfers) {
				expect(ix.keys.owner.pubkey).toEqual(hold.publicKey);
			}
			expect(txn.signatures).toHaveLength(1);
			expect(txn.verifySignatures()).toBe(true);
		},
	);
});
