// SOL balances and devnet airdrops. Amounts are bigint lamports.
import type { Connection, PublicKey } from "@solana/web3.js";
import { retry } from "./retry.js";

export const LAMPORTS_PER_SOL = 1_000_000_000n;
const MIN_LAMPORTS = LAMPORTS_PER_SOL / 2n;
const AIRDROP_LAMPORTS = LAMPORTS_PER_SOL;

export const lamports = async (
	conn: Connection,
	owner: PublicKey,
): Promise<bigint> => BigInt(await conn.getBalance(owner));

export const ensureSol = async (
	conn: Connection,
	name: string,
	owner: PublicKey,
): Promise<void> => {
	const balance = await lamports(conn, owner);
	if (balance >= MIN_LAMPORTS) {
		return;
	}
	try {
		await retry(`airdrop ${name}`, async () => {
			// requestAirdrop takes a JS number; 1 SOL in lamports is well inside the safe integer range.
			const sig = await conn.requestAirdrop(owner, Number(AIRDROP_LAMPORTS));
			const blockhash = await conn.getLatestBlockhash();
			await conn.confirmTransaction(
				{ signature: sig, ...blockhash },
				"confirmed",
			);
			console.log(
				`airdropped ${AIRDROP_LAMPORTS / LAMPORTS_PER_SOL} SOL to ${name}: ${sig}`,
			);
		});
	} catch {
		console.warn(
			`airdrop to ${name} gave up; balance stays ${balance} lamports`,
		);
	}
};
