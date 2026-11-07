// Devnet only: after a run (or a failed funding) every firm wallet sends its USDC and SOL back
// to the agent wallet; the agent pays the fee. Firm keys live only in memory, so this is the
// only way back for the funds.
import {
	createCloseAccountInstruction,
	createTransferCheckedInstruction,
	getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
	type Connection,
	type Keypair,
	PublicKey,
	SystemProgram,
	sendAndConfirmTransaction,
	Transaction,
} from "@solana/web3.js";
import { withRetry } from "./devnetRpc.js";

const USDC_DECIMALS = 6;

const sweepOne = async (
	connection: Connection,
	agent: Keypair,
	mint: PublicKey,
	firm: Keypair,
): Promise<void> => {
	const firmAta = getAssociatedTokenAddressSync(mint, firm.publicKey);
	const agentAta = getAssociatedTokenAddressSync(mint, agent.publicKey);
	const ata = await withRetry("firm token account", () =>
		connection.getAccountInfo(firmAta),
	);
	const lamports = await withRetry("firm SOL", () =>
		connection.getBalance(firm.publicKey),
	);
	const tx = new Transaction();
	if (ata !== null) {
		const units = BigInt(
			(
				await withRetry("firm USDC", () =>
					connection.getTokenAccountBalance(firmAta),
				)
			).value.amount,
		);
		if (units > 0n) {
			tx.add(
				createTransferCheckedInstruction(
					firmAta,
					mint,
					agentAta,
					firm.publicKey,
					units,
					USDC_DECIMALS,
				),
			);
		}
		tx.add(
			createCloseAccountInstruction(firmAta, agent.publicKey, firm.publicKey),
		);
	}
	if (lamports > 0) {
		tx.add(
			SystemProgram.transfer({
				fromPubkey: firm.publicKey,
				toPubkey: agent.publicKey,
				lamports,
			}),
		);
	}
	if (tx.instructions.length === 0) {
		return;
	}
	tx.feePayer = agent.publicKey;
	await withRetry(`sweep firm ${firm.publicKey.toBase58()}`, () =>
		sendAndConfirmTransaction(connection, tx, [agent, firm]),
	);
};

export const sweepFirms = async (
	connection: Connection,
	agent: Keypair,
	mint: string,
	firms: Keypair[],
): Promise<void> => {
	const mintKey = new PublicKey(mint);
	for (const firm of firms) {
		try {
			await sweepOne(connection, agent, mintKey, firm);
		} catch (error) {
			console.error(
				`e2e devnet sweep failed for ${firm.publicKey.toBase58()}: ${String(error)}`,
			);
		}
	}
};
