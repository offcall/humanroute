// Devnet reads: agent USDC preflight and per-owner USDC deltas plus memo of one transaction.
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { type Connection, PublicKey } from "@solana/web3.js";

export type TxFacts = { deltas: Map<string, bigint>; memos: string[] };

const NEEDED_UNITS = 1_500_000n;

export const agentUsdc = async (
	connection: Connection,
	owner: string,
	mint: string,
): Promise<bigint> => {
	const address = await getAssociatedTokenAddress(
		new PublicKey(mint),
		new PublicKey(owner),
	);
	try {
		const balance = await connection.getTokenAccountBalance(address);
		return BigInt(balance.value.amount);
	} catch {
		return 0n;
	}
};

export const preflight = async (
	connection: Connection,
	owner: string,
	mint: string,
): Promise<boolean> => {
	const units = await agentUsdc(connection, owner, mint);
	if (units >= NEEDED_UNITS) {
		return true;
	}
	console.error(
		`agent ${owner} has ${units} USDC units, need 1.5 USDC (1500000 units): faucet.circle.com`,
	);
	return false;
};

export const txFacts = async (
	connection: Connection,
	signature: string,
	mint: string,
): Promise<TxFacts> => {
	const tx = await connection.getParsedTransaction(signature, {
		maxSupportedTransactionVersion: 0,
		commitment: "confirmed",
	});
	if (tx === null || tx.meta === null || tx.meta === undefined) {
		throw new Error(`transaction ${signature} not found`);
	}
	if (tx.meta.err !== null) {
		throw new Error(`transaction ${signature} failed on chain`);
	}
	const deltas = new Map<string, bigint>();
	const apply = (
		sign: bigint,
		list: typeof tx.meta.postTokenBalances,
	): void => {
		for (const entry of list ?? []) {
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
	for (const ix of tx.transaction.message.instructions) {
		if ("parsed" in ix && ix.program === "spl-memo") {
			memos.push(String(ix.parsed));
		}
	}
	return { deltas, memos };
};
