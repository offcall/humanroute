// An x402 exact payment built offline in the @x402/svm layout: compute limit, compute price,
// TransferChecked payer ATA -> payTo ATA, memo. The fake facilitator does not check it; the
// gateway hashes its message for the payment id (ADR 0004), so a different memo is a new payment.
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
import {
	type PaymentRequirementsV2,
	parsePaymentRequired,
	type ResourceInfo,
} from "@x402/core/schemas";
import { FAKE_BLOCKHASH } from "./chain.js";

const MEMO_PROGRAM = new PublicKey(
	"MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);
const USDC_DECIMALS = 6;

export type Offer = {
	accepted: PaymentRequirementsV2;
	resource: ResourceInfo | undefined;
};

// The exact offer from a 402 answer's PAYMENT-REQUIRED header.
export const readOffer = (res: Response): Offer => {
	const header = res.headers.get("PAYMENT-REQUIRED");
	if (header === null) {
		throw new Error(`no PAYMENT-REQUIRED header on HTTP ${res.status}`);
	}
	const raw: unknown = JSON.parse(
		Buffer.from(header, "base64").toString("utf8"),
	);
	const parsed = parsePaymentRequired(raw);
	if (!parsed.success || parsed.data.x402Version !== 2) {
		throw new Error("PAYMENT-REQUIRED is not an x402 v2 offer");
	}
	const accepted = parsed.data.accepts.find(
		(offer) => offer.scheme === "exact",
	);
	if (accepted === undefined) {
		throw new Error("the offer has no exact scheme");
	}

	return { accepted, resource: parsed.data.resource };
};

// PAYMENT-SIGNATURE value for the offer, paid by `payer`; the memo makes the payment unique.
export const paymentHeader = (
	offer: Offer,
	payer: PublicKey,
	memo: string,
): string => {
	const { accepted } = offer;
	const feePayer = accepted.extra?.feePayer;
	if (typeof feePayer !== "string") {
		throw new Error("the offer has no fee payer");
	}
	const mint = new PublicKey(accepted.asset);
	const payTo = new PublicKey(accepted.payTo);
	const instructions = [
		ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
		ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
		createTransferCheckedInstruction(
			getAssociatedTokenAddressSync(mint, payer),
			mint,
			getAssociatedTokenAddressSync(mint, payTo),
			payer,
			BigInt(accepted.amount),
			USDC_DECIMALS,
		),
		new TransactionInstruction({
			programId: MEMO_PROGRAM,
			keys: [],
			data: Buffer.from(memo, "utf8"),
		}),
	];
	const message = new TransactionMessage({
		payerKey: new PublicKey(feePayer),
		recentBlockhash: FAKE_BLOCKHASH,
		instructions,
	}).compileToV0Message();
	const transaction = Buffer.from(
		new VersionedTransaction(message).serialize(),
	).toString("base64");
	const payload = { x402Version: 2, ...offer, payload: { transaction } };

	return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
};
