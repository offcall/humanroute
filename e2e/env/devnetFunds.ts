// Devnet only: fresh firm wallets funded from the agent wallet (USDC and a little SOL for the
// auto-pay Approve/Revoke fees). Amounts are small and set by env; the run spends real devnet funds.
import {
	createAssociatedTokenAccountIdempotent,
	getAssociatedTokenAddressSync,
	transfer,
} from "@solana/spl-token";
import {
	type Connection,
	Keypair,
	LAMPORTS_PER_SOL,
	PublicKey,
	SystemProgram,
	sendAndConfirmTransaction,
	Transaction,
} from "@solana/web3.js";

const FIRM_COUNT = Number(process.env.E2E_DEVNET_FIRMS ?? "16");
const FIRM_UNITS = BigInt(process.env.E2E_DEVNET_FIRM_UNITS ?? "2000000");
const FIRM_LAMPORTS = Math.round(
	Number(process.env.E2E_DEVNET_FIRM_SOL ?? "0.02") * LAMPORTS_PER_SOL,
);

export const fundFirms = async (
	connection: Connection,
	agent: Keypair,
	mint: string,
): Promise<Keypair[]> => {
	const mintKey = new PublicKey(mint);
	const source = getAssociatedTokenAddressSync(mintKey, agent.publicKey);
	const balance = BigInt(
		(await connection.getTokenAccountBalance(source)).value.amount,
	);
	const needed = FIRM_UNITS * BigInt(FIRM_COUNT);
	if (balance < needed) {
		throw new Error(
			`agent ${agent.publicKey.toBase58()} has ${balance} USDC units, the run needs ${needed} (faucet.circle.com)`,
		);
	}
	const firms = Array.from({ length: FIRM_COUNT }, () => Keypair.generate());
	for (const firm of firms) {
		const sol = new Transaction().add(
			SystemProgram.transfer({
				fromPubkey: agent.publicKey,
				toPubkey: firm.publicKey,
				lamports: FIRM_LAMPORTS,
			}),
		);
		await sendAndConfirmTransaction(connection, sol, [agent]);
		const target = await createAssociatedTokenAccountIdempotent(
			connection,
			agent,
			mintKey,
			firm.publicKey,
		);
		await transfer(connection, agent, source, target, agent, FIRM_UNITS);
	}
	return firms;
};
