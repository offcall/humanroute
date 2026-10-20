// Read-only chain lookups: signature status with history, block height, memo search.
import type { Connection, PublicKey } from "@solana/web3.js";
import { Commitment } from "../config/index.js";
import { classify } from "./errors.js";
import { type ChainResult, Phase, type SignatureStatus } from "./types.js";

const MEMO_SEARCH_LIMIT = 200;

export const signatureStatus = async (
	conn: Connection,
	signature: string,
	commitment: Commitment,
): Promise<ChainResult<SignatureStatus>> => {
	try {
		const { value } = await conn.getSignatureStatuses([signature], {
			searchTransactionHistory: true,
		});
		const status = value[0];
		if (!status) {
			return { ok: true, value: { state: "unknown" } };
		}
		if (status.err) {
			return {
				ok: true,
				value: { state: "failed", error: JSON.stringify(status.err) },
			};
		}
		const level = status.confirmationStatus;
		const reached =
			commitment === Commitment.Finalized
				? level === "finalized"
				: level === "confirmed" || level === "finalized";
		return { ok: true, value: { state: reached ? "confirmed" : "pending" } };
	} catch (err) {
		return { ok: false, error: classify(err, Phase.Prepare) };
	}
};

export const blockHeight = async (
	conn: Connection,
	commitment: Commitment,
): Promise<ChainResult<number>> => {
	try {
		return { ok: true, value: await conn.getBlockHeight(commitment) };
	} catch (err) {
		return { ok: false, error: classify(err, Phase.Prepare) };
	}
};

// Second safety net before a resend: a successful hold transaction that already carries this memo.
export const findMemo = async (
	conn: Connection,
	hold: PublicKey,
	memo: string,
): Promise<ChainResult<string | null>> => {
	try {
		const sigs = await conn.getSignaturesForAddress(
			hold,
			{ limit: MEMO_SEARCH_LIMIT },
			"confirmed",
		);
		const hit = sigs.find(
			(info) =>
				info.err === null && info.memo !== null && info.memo.includes(memo),
		);
		return { ok: true, value: hit ? hit.signature : null };
	} catch (err) {
		return { ok: false, error: classify(err, Phase.Prepare) };
	}
};
