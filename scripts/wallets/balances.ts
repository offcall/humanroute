// Token balances and their display (bigint base units).
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { Connection, PublicKey } from "@solana/web3.js";

export const DECIMALS = 6;

export const formatUnits = (amount: bigint, decimals = DECIMALS): string => {
	const base = 10n ** BigInt(decimals);
	return `${amount / base}.${(amount % base).toString().padStart(decimals, "0")}`;
};

export const tokenBalance = async (
	conn: Connection,
	mint: PublicKey,
	owner: PublicKey,
): Promise<bigint | null> => {
	try {
		return (await getAccount(conn, getAssociatedTokenAddressSync(mint, owner)))
			.amount;
	} catch {
		return null;
	}
};
