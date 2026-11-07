// The cabinet's auto-pay view (ADR 0036): the firm's USDC account, delegate, allowance, SOL and a
// fresh blockhash, read from chain. null when a chain read fails.
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import type { OrdersDeps } from "./types.js";

export const autopayView = async (
	deps: OrdersDeps,
	wallet: string,
): Promise<Record<string, unknown> | null> => {
	const [account, blockhash, sol] = await Promise.all([
		deps.tokenAccountOf(wallet),
		deps.latestBlockhash(),
		deps.solBalanceOf(wallet),
	]);
	if (!account.ok || !blockhash.ok || !sol.ok) {
		return null;
	}
	const usdc = account.value;
	const held = usdc.exists
		? {
				balanceUnits: usdc.amount.toString(),
				delegate: usdc.delegate,
				allowanceUnits: usdc.delegatedAmount.toString(),
			}
		: {};
	const { payTo, usdcMint: mint } = deps;
	const payToAccount = getAssociatedTokenAddressSync(
		new PublicKey(mint),
		new PublicKey(payTo),
	).toBase58();
	const solLamports = sol.value;
	const base = {
		wallet,
		mint,
		payTo,
		payToAccount,
		solLamports,
		...blockhash.value,
	};
	return {
		...base,
		account: usdc.address,
		exists: usdc.exists,
		...held,
	};
};
