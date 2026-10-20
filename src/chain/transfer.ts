// Builds and signs TransferChecked (hold ATA -> recipient ATA) plus a Memo. Pure: no network.

import { base58 } from "@scure/base";
import {
	createTransferCheckedInstruction,
	getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
	PublicKey,
	Transaction,
	TransactionInstruction,
} from "@solana/web3.js";
import type {
	SignedTransfer,
	TransferParams,
	TransferRequest,
} from "./types.js";

export const MEMO_PROGRAM_ID = new PublicKey(
	"MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

export const recipientAta = (mint: PublicKey, wallet: string): PublicKey =>
	getAssociatedTokenAddressSync(mint, new PublicKey(wallet));

export const signTransfer = (
	params: TransferParams,
	req: TransferRequest,
): SignedTransfer => {
	const fromAta = getAssociatedTokenAddressSync(
		params.mint,
		params.hold.publicKey,
	);
	const toAta = recipientAta(params.mint, req.toWallet);
	const txn = new Transaction({
		feePayer: params.hold.publicKey,
		blockhash: params.blockhash,
		lastValidBlockHeight: params.lastValidBlockHeight,
	}).add(
		createTransferCheckedInstruction(
			fromAta,
			params.mint,
			toAta,
			params.hold.publicKey,
			req.amount,
			params.decimals,
		),
		new TransactionInstruction({
			programId: MEMO_PROGRAM_ID,
			keys: [
				{ pubkey: params.hold.publicKey, isSigner: true, isWritable: false },
			],
			data: Buffer.from(req.memo, "utf8"),
		}),
	);
	txn.sign(params.hold);
	const sig = txn.signature;
	if (!sig) {
		throw new Error("transaction has no signature after signing");
	}
	return {
		signature: base58.encode(sig),
		blockhash: params.blockhash,
		lastValidBlockHeight: params.lastValidBlockHeight,
		bytes: txn.serialize(),
	};
};
