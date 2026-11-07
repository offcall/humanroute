// On-chain reads for e2e checks: token balances, per-owner deltas and memos of one transaction.
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { connection, e2eEnv } from "./env.js";

export type TxFacts = {
	deltas: Map<string, bigint>;
	memos: string[];
	programs: string[];
	payer: string;
};

export const ataOf = (owner: string): PublicKey =>
	getAssociatedTokenAddressSync(
		new PublicKey(e2eEnv().mint),
		new PublicKey(owner),
	);

export const usdcOf = async (owner: string): Promise<bigint> => {
	try {
		const balance = await connection().getTokenAccountBalance(ataOf(owner));
		return BigInt(balance.value.amount);
	} catch {
		return 0n;
	}
};

export const ataExists = async (owner: string): Promise<boolean> =>
	(await connection().getAccountInfo(ataOf(owner))) !== null;

export const txFacts = async (signature: string): Promise<TxFacts> => {
	const mint = e2eEnv().mint;
	const tx = await connection().getParsedTransaction(signature, {
		maxSupportedTransactionVersion: 0,
		commitment: "confirmed",
	});
	if (tx === null || !tx.meta) {
		throw new Error(`transaction ${signature} not found`);
	}
	if (tx.meta.err !== null) {
		throw new Error(`transaction ${signature} failed on chain`);
	}
	const deltas = new Map<string, bigint>();
	const apply = (sign: bigint, entries: typeof tx.meta.postTokenBalances) => {
		for (const entry of entries ?? []) {
			if (entry.mint === mint && entry.owner !== undefined) {
				const before = deltas.get(entry.owner) ?? 0n;
				deltas.set(
					entry.owner,
					before + sign * BigInt(entry.uiTokenAmount.amount),
				);
			}
		}
	};
	apply(-1n, tx.meta.preTokenBalances);
	apply(1n, tx.meta.postTokenBalances);

	const memos: string[] = [];
	const programs: string[] = [];
	for (const ix of tx.transaction.message.instructions) {
		programs.push("program" in ix ? ix.program : ix.programId.toBase58());
		if ("parsed" in ix && ix.program === "spl-memo") {
			memos.push(String(ix.parsed));
		}
	}
	const payer = tx.transaction.message.accountKeys[0]?.pubkey.toBase58() ?? "";
	return { deltas, memos, programs, payer };
};
