// Unsigned x402 exact payment signed by the firm's SPL delegate (ADR 0036). Same layout as the
// @x402/svm client: compute limit, compute price, TransferChecked, random memo; v0 message.
import { randomBytes } from "node:crypto";
import {
	createTransferCheckedInstruction,
	getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
	ComputeBudgetProgram,
	PublicKey,
	TransactionInstruction,
	TransactionMessage,
	VersionedTransaction,
} from "@solana/web3.js";
import { USDC_DECIMALS } from "../config/index.js";

const COMPUTE_UNIT_LIMIT = 20_000;
const COMPUTE_UNIT_PRICE_MICROLAMPORTS = 1;
const MEMO_PROGRAM = new PublicKey(
	"MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

export type UnsignedInput = {
	firmWallet: string;
	delegate: string;
	feePayer: string;
	mint: string;
	payTo: string;
	amountUnits: bigint;
	blockhash: string;
};

export type UnsignedTx = { transaction: string; message: string };

export const buildUnsignedTx = (input: UnsignedInput): UnsignedTx => {
	const mint = new PublicKey(input.mint);
	const source = getAssociatedTokenAddressSync(
		mint,
		new PublicKey(input.firmWallet),
	);
	const destination = getAssociatedTokenAddressSync(
		mint,
		new PublicKey(input.payTo),
	);
	// A random memo keeps two equal payments in one blockhash distinct (payment id, ADR 0004).
	const memo = new TransactionInstruction({
		programId: MEMO_PROGRAM,
		keys: [],
		data: Buffer.from(randomBytes(16).toString("hex"), "utf8"),
	});
	const instructions = [
		ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
		ComputeBudgetProgram.setComputeUnitPrice({
			microLamports: COMPUTE_UNIT_PRICE_MICROLAMPORTS,
		}),
		createTransferCheckedInstruction(
			source,
			mint,
			destination,
			new PublicKey(input.delegate),
			input.amountUnits,
			USDC_DECIMALS,
		),
		memo,
	];
	const message = new TransactionMessage({
		payerKey: new PublicKey(input.feePayer),
		recentBlockhash: input.blockhash,
		instructions,
	}).compileToV0Message();
	const transaction = new VersionedTransaction(message);

	return {
		transaction: Buffer.from(transaction.serialize()).toString("base64"),
		message: Buffer.from(message.serialize()).toString("base64"),
	};
};
