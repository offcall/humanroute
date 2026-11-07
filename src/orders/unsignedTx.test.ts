// The unsigned delegate payment (ADR 0036): the @x402/svm layout, signed later by the delegate.
import {
	decodeTransferCheckedInstruction,
	getAssociatedTokenAddressSync,
	TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
	ComputeBudgetProgram,
	PublicKey,
	TransactionInstruction,
	VersionedTransaction,
} from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import {
	createDraft,
	createTestGateway,
	expectJson,
	FAKE_BLOCKHASH,
	registerFirm,
	send,
	textField,
	WALLETS,
} from "../testing/index.js";
import { paymentId } from "./paymentId.js";
import { buildUnsignedTx, type UnsignedInput } from "./unsignedTx.js";

// AP-27 replaces the memo randomness with fixed bytes; every other caller gets real bytes.
const memoBytes = vi.hoisted((): Buffer[] => []);
vi.mock("node:crypto", async (importOriginal) => {
	const real = await importOriginal<typeof import("node:crypto")>();
	const randomBytes = (size: number) =>
		memoBytes.shift() ?? real.randomBytes(size);
	return { ...real, randomBytes };
});

const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
// Above 2^53, so a number anywhere on the way would lose it.
const BIG_TOTAL = 9_007_199_254_740_993n;

const INPUT: UnsignedInput = {
	firmWallet: WALLETS.firm.address,
	delegate: WALLETS.agent.address,
	feePayer: WALLETS.facilitator.address,
	mint: MINT,
	payTo: WALLETS.hold.address,
	amountUnits: BIG_TOTAL,
	blockhash: FAKE_BLOCKHASH,
};

const ata = (owner: string) =>
	getAssociatedTokenAddressSync(new PublicKey(MINT), new PublicKey(owner));

const decompile = (transaction: VersionedTransaction) => {
	const { message } = transaction;
	const keys = message.staticAccountKeys;
	return message.compiledInstructions.map(
		(ix) =>
			new TransactionInstruction({
				programId: keys[ix.programIdIndex] ?? PublicKey.default,
				keys: ix.accountKeyIndexes.map((at) => ({
					pubkey: keys[at] ?? PublicKey.default,
					isSigner: message.isAccountSigner(at),
					isWritable: message.isAccountWritable(at),
				})),
				data: Buffer.from(ix.data),
			}),
	);
};

describe("unsigned delegate payment", () => {
	it("AP-20 builds an unsigned v0 x402 payment", async () => {
		const unsigned = buildUnsignedTx(INPUT);
		const transaction = VersionedTransaction.deserialize(
			Buffer.from(unsigned.transaction, "base64"),
		);
		const { message } = transaction;
		expect(message.version).toBe(0);
		expect(message.addressTableLookups).toEqual([]);
		expect(Buffer.from(message.serialize()).toString("base64")).toBe(
			unsigned.message,
		);

		expect(message.header.numRequiredSignatures).toBe(2);
		const signers = message.staticAccountKeys.slice(0, 2).map(String);
		expect(signers).toEqual([INPUT.feePayer, INPUT.delegate]);
		expect(transaction.signatures).toHaveLength(2);
		for (const slot of transaction.signatures) {
			expect(slot.every((byte) => byte === 0)).toBe(true);
		}

		const [limit, price, transfer, memo, ...extra] = decompile(transaction);
		expect(extra).toEqual([]);
		expect(limit?.programId.equals(ComputeBudgetProgram.programId)).toBe(true);
		expect(limit?.data.readUInt32LE(1)).toBe(20_000);
		expect(price?.programId.equals(ComputeBudgetProgram.programId)).toBe(true);
		expect(price?.data.readBigUInt64LE(1)).toBe(1n);
		if (transfer === undefined) {
			throw new Error("no transfer instruction");
		}
		const decoded = decodeTransferCheckedInstruction(
			transfer,
			TOKEN_PROGRAM_ID,
		);
		expect(decoded.keys.source.pubkey.equals(ata(INPUT.firmWallet))).toBe(true);
		expect(decoded.keys.mint.pubkey.toBase58()).toBe(MINT);
		expect(decoded.keys.destination.pubkey.equals(ata(INPUT.payTo))).toBe(true);
		expect(decoded.keys.owner.pubkey.toBase58()).toBe(INPUT.delegate);
		expect(decoded.keys.owner.isSigner).toBe(true);
		expect(decoded.data.amount).toBe(BIG_TOTAL);
		expect(decoded.data.decimals).toBe(6);
		expect(memo?.programId.toBase58()).toBe(MEMO_PROGRAM);
		expect(memo?.keys).toEqual([]);
		expect(memo?.data.toString("utf8")).toMatch(/^[0-9a-f]{32}$/);
	});

	it("AP-20 the route answers the builder's payment with signer = delegate", async () => {
		const gateway = createTestGateway();
		const firm = await registerFirm(gateway.app, WALLETS.firm);
		const delegate = WALLETS.agent.address;
		gateway.chain.answer.tokenAccount = async (owner) => ({
			ok: true,
			value: {
				exists: true,
				address: ata(owner).toBase58(),
				amount: 1_000_000n,
				delegate,
				delegatedAmount: 1_000_000n,
			},
		});
		const draftId = textField(
			await createDraft(gateway.app, firm.mcpToken),
			"draftId",
		);
		const feePayer = WALLETS.facilitator.address;
		const body = await expectJson(
			await send(gateway.app, "POST", `/api/orders/draft/${draftId}/unsigned`, {
				bearer: firm.mcpToken,
				body: { feePayer },
			}),
			200,
		);
		expect(body).toEqual({
			transaction: expect.any(String),
			message: expect.any(String),
			signer: delegate,
			amountUnits: "1000000",
			payTo: WALLETS.hold.address,
		});
		const transaction = VersionedTransaction.deserialize(
			Buffer.from(textField(body, "transaction"), "base64"),
		);
		expect(
			Buffer.from(transaction.message.serialize()).toString("base64"),
		).toBe(body.message);
		const keys = transaction.message.staticAccountKeys.map(String);
		expect(keys.slice(0, 2)).toEqual([feePayer, delegate]);
	});

	it("AP-27 two unsigned payments for the same draft differ, so each has its own payment id", () => {
		memoBytes.push(Buffer.alloc(16, 0xaa), Buffer.alloc(16, 0xbb));
		const first = buildUnsignedTx(INPUT);
		const second = buildUnsignedTx(INPUT);
		expect(memoBytes).toEqual([]);

		const memoOf = (unsigned: { transaction: string }) => {
			const transaction = VersionedTransaction.deserialize(
				Buffer.from(unsigned.transaction, "base64"),
			);
			return decompile(transaction)[3]?.data.toString("utf8");
		};
		expect(memoOf(first)).toBe("aa".repeat(16));
		expect(memoOf(second)).toBe("bb".repeat(16));
		expect(second.message).not.toBe(first.message);

		const header = (transaction: string) =>
			Buffer.from(
				JSON.stringify({ x402Version: 2, payload: { transaction } }),
			).toString("base64");
		const firstId = paymentId(header(first.transaction));
		const secondId = paymentId(header(second.transaction));
		expect(firstId).toMatch(/^[0-9a-f]{64}$/);
		expect(secondId).toMatch(/^[0-9a-f]{64}$/);
		expect(secondId).not.toBe(firstId);
	});
});
