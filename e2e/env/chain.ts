// Localnet chain state for one run: SOL airdrops, an own 6-decimal mint, the hold token account,
// and firm wallets with USDC. All keys are fresh per run and never leave the temp dir.
import {
	createAssociatedTokenAccountIdempotent,
	createMint,
	mintTo,
} from "@solana/spl-token";
import {
	type Connection,
	Keypair,
	LAMPORTS_PER_SOL,
	type PublicKey,
} from "@solana/web3.js";
import { FIRM_COUNT } from "../support/firms.js";

const USDC_DECIMALS = 6;
export const FIRM_USDC_UNITS = 20_000_000n;

export type LocalChain = {
	mint: PublicKey;
	hold: Keypair;
	fee: Keypair;
	facilitator: Keypair;
	firms: Keypair[];
};

const airdrop = async (
	connection: Connection,
	to: PublicKey,
	sol: number,
): Promise<void> => {
	const signature = await connection.requestAirdrop(to, sol * LAMPORTS_PER_SOL);
	const latest = await connection.getLatestBlockhash("confirmed");
	await connection.confirmTransaction({ signature, ...latest }, "confirmed");
};

export const setupChain = async (
	connection: Connection,
): Promise<LocalChain> => {
	const authority = Keypair.generate();
	const hold = Keypair.generate();
	const fee = Keypair.generate();
	const facilitator = Keypair.generate();
	const firms = Array.from({ length: FIRM_COUNT }, () => Keypair.generate());

	await Promise.all([
		airdrop(connection, authority.publicKey, 10),
		airdrop(connection, hold.publicKey, 10),
		airdrop(connection, facilitator.publicKey, 10),
		...firms.map((firm) => airdrop(connection, firm.publicKey, 1)),
	]);

	const mint = await createMint(
		connection,
		authority,
		authority.publicKey,
		null,
		USDC_DECIMALS,
	);
	await createAssociatedTokenAccountIdempotent(
		connection,
		authority,
		mint,
		hold.publicKey,
	);
	const fund = async (firm: Keypair): Promise<void> => {
		const account = await createAssociatedTokenAccountIdempotent(
			connection,
			authority,
			mint,
			firm.publicKey,
		);
		await mintTo(
			connection,
			authority,
			mint,
			account,
			authority,
			FIRM_USDC_UNITS,
		);
	};
	await Promise.all(firms.map(fund));
	return { mint, hold, fee, facilitator, firms };
};
