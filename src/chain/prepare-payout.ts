// Prepares a payout with a fresh blockhash without checking recipient accounts or broadcasting.
import { type Connection, PublicKey } from "@solana/web3.js";
import { USDC_DECIMALS } from "../config/index.js";
import { classify } from "./errors.js";
import { signPayout } from "./payout.js";
import {
	type ChainResult,
	ErrorKind,
	type PayoutRequest,
	Phase,
	type SignedTransfer,
	type SolanaOptions,
} from "./types.js";

// Deterministic input errors: retrying the same request can never succeed.
const invalidReason = (req: PayoutRequest): string | null => {
	if (req.legs.some((leg) => leg.amountUnits < 0n)) {
		return "payout leg amount must not be negative";
	}
	if (req.legs.every((leg) => leg.amountUnits === 0n)) {
		return "payout requires at least one non-zero leg";
	}
	const badWallet = req.legs.some((leg) => !isOwnerWallet(leg.ownerWallet));
	return badWallet ? "payout leg has an invalid wallet address" : null;
};

// Owners must be on-curve keys: ATA derivation rejects PDAs.
const isOwnerWallet = (wallet: string): boolean => {
	try {
		return PublicKey.isOnCurve(new PublicKey(wallet).toBytes());
	} catch {
		return false;
	}
};

export const preparePayout = async (
	conn: Connection,
	opts: SolanaOptions,
	mint: PublicKey,
	req: PayoutRequest,
): Promise<ChainResult<SignedTransfer>> => {
	const reason = invalidReason(req);
	if (reason !== null) {
		return { ok: false, error: { kind: ErrorKind.Final, message: reason } };
	}

	try {
		const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash(
			opts.commitment,
		);
		const params = {
			hold: opts.hold,
			mint,
			decimals: USDC_DECIMALS,
			blockhash,
			lastValidBlockHeight,
		};

		return { ok: true, value: signPayout(params, req) };
	} catch (err) {
		return { ok: false, error: classify(err, Phase.Prepare) };
	}
};
