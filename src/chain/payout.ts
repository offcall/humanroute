// Builds and signs payout ATA creation, checked transfers and a memo. Pure: no network.
import { base58 } from "@scure/base";
import {
	createAssociatedTokenAccountIdempotentInstruction,
	createTransferCheckedInstruction,
	getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
	PublicKey,
	Transaction,
	TransactionInstruction,
} from "@solana/web3.js";
import { MEMO_PROGRAM_ID } from "./transfer.js";
import type { PayoutRequest, SignedTransfer, TransferParams } from "./types.js";

export const signPayout = (
	params: TransferParams,
	req: PayoutRequest,
): SignedTransfer => {
	if (req.legs.some((leg) => leg.amountUnits < 0n)) {
		throw new Error("payout leg amount must not be negative");
	}

	const legs = req.legs.filter((leg) => leg.amountUnits > 0n);
	if (legs.length === 0) {
		throw new Error("payout requires at least one non-zero leg");
	}

	const recipients = legs.map((leg) => {
		const owner = new PublicKey(leg.ownerWallet);

		return {
			owner,
			ata: getAssociatedTokenAddressSync(params.mint, owner),
			amountUnits: leg.amountUnits,
		};
	});
	const fromAta = getAssociatedTokenAddressSync(
		params.mint,
		params.hold.publicKey,
	);
	const txn = new Transaction({
		feePayer: params.hold.publicKey,
		blockhash: params.blockhash,
		lastValidBlockHeight: params.lastValidBlockHeight,
	});

	for (const recipient of recipients) {
		txn.add(
			createAssociatedTokenAccountIdempotentInstruction(
				params.hold.publicKey,
				recipient.ata,
				recipient.owner,
				params.mint,
			),
		);
	}

	for (const recipient of recipients) {
		txn.add(
			createTransferCheckedInstruction(
				fromAta,
				params.mint,
				recipient.ata,
				params.hold.publicKey,
				recipient.amountUnits,
				params.decimals,
			),
		);
	}

	txn.add(
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
	if (sig === null) {
		throw new Error("transaction has no signature after signing");
	}

	return {
		signature: base58.encode(sig),
		blockhash: params.blockhash,
		lastValidBlockHeight: params.lastValidBlockHeight,
		bytes: txn.serialize(),
	};
};
