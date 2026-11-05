// Read-only chain lookups for auto-pay (ADR 0036): a wallet's token account and a fresh blockhash.
import {
	getAccount,
	getAssociatedTokenAddressSync,
	TokenAccountNotFoundError,
} from "@solana/spl-token";
import { type Connection, PublicKey } from "@solana/web3.js";
import type { Commitment } from "../config/index.js";
import { classify } from "./errors.js";
import {
	type ChainResult,
	Phase,
	type RecentBlockhash,
	type TokenAccount,
} from "./types.js";

export const tokenAccount = async (
	conn: Connection,
	mint: PublicKey,
	owner: string,
	commitment: Commitment,
): Promise<ChainResult<TokenAccount>> => {
	const address = getAssociatedTokenAddressSync(mint, new PublicKey(owner));
	try {
		const account = await getAccount(conn, address, commitment);
		return {
			ok: true,
			value: {
				exists: true,
				address: address.toBase58(),
				amount: account.amount,
				delegate:
					account.delegate === null ? null : account.delegate.toBase58(),
				delegatedAmount: account.delegatedAmount,
			},
		};
	} catch (err) {
		if (err instanceof TokenAccountNotFoundError) {
			return {
				ok: true,
				value: { exists: false, address: address.toBase58() },
			};
		}
		return { ok: false, error: classify(err, Phase.Prepare) };
	}
};

export const latestBlockhash = async (
	conn: Connection,
	commitment: Commitment,
): Promise<ChainResult<RecentBlockhash>> => {
	try {
		const latest = await conn.getLatestBlockhash(commitment);
		const { blockhash, lastValidBlockHeight } = latest;
		return { ok: true, value: { blockhash, lastValidBlockHeight } };
	} catch (err) {
		return { ok: false, error: classify(err, Phase.Prepare) };
	}
};
