// Devnet only: fresh firm wallets funded from the agent wallet (USDC and a little SOL for the
// auto-pay Approve/Revoke fees), a few firms per transaction. USDC per slot is DEVNET_FIRM_UNITS;
// the run spends real devnet funds. sweepFirms (devnetSweep.ts) returns what is left.
import {
	createAssociatedTokenAccountIdempotentInstruction,
	createTransferCheckedInstruction,
	getAssociatedTokenAddressSync,
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
import {
	DEVNET_FIRM_UNITS,
	FIRM_COUNT,
	type FirmSlot,
} from "../support/firms.js";
import { withRetry } from "./devnetRpc.js";

const FIRM_LAMPORTS = Math.round(
	Number(process.env.E2E_DEVNET_FIRM_SOL ?? "0.02") * LAMPORTS_PER_SOL,
);
const FIRMS_PER_TX = 3;
const USDC_DECIMALS = 6;

export const newFirms = (): Keypair[] =>
	Array.from({ length: FIRM_COUNT }, () => Keypair.generate());

// Index in firms is the FirmSlot.
const unitsAt = (slot: FirmSlot): bigint => DEVNET_FIRM_UNITS[slot];

const fundBatch = (
	connection: Connection,
	agent: Keypair,
	mint: PublicKey,
	batch: Keypair[],
	firstSlot: number,
): Promise<string> => {
	const source = getAssociatedTokenAddressSync(mint, agent.publicKey);
	const tx = new Transaction();
	for (const [offset, firm] of batch.entries()) {
		const units = unitsAt(firstSlot + offset);
		const target = getAssociatedTokenAddressSync(mint, firm.publicKey);
		tx.add(
			SystemProgram.transfer({
				fromPubkey: agent.publicKey,
				toPubkey: firm.publicKey,
				lamports: FIRM_LAMPORTS,
			}),
			createAssociatedTokenAccountIdempotentInstruction(
				agent.publicKey,
				target,
				firm.publicKey,
				mint,
			),
		);
		if (units > 0n) {
			tx.add(
				createTransferCheckedInstruction(
					source,
					mint,
					target,
					agent.publicKey,
					units,
					USDC_DECIMALS,
				),
			);
		}
	}
	return sendAndConfirmTransaction(connection, tx, [agent]);
};

export const fundFirms = async (
	connection: Connection,
	agent: Keypair,
	mint: string,
	firms: Keypair[],
): Promise<void> => {
	const mintKey = new PublicKey(mint);
	const source = getAssociatedTokenAddressSync(mintKey, agent.publicKey);
	const balance = BigInt(
		(
			await withRetry("agent USDC balance", () =>
				connection.getTokenAccountBalance(source),
			)
		).value.amount,
	);
	const needed = firms.reduce((sum, _firm, slot) => sum + unitsAt(slot), 0n);
	if (balance < needed) {
		throw new Error(
			`agent ${agent.publicKey.toBase58()} has ${balance} USDC units, the run funds firms with ${needed} upfront: top up at faucet.circle.com`,
		);
	}

	for (let start = 0; start < firms.length; start += FIRMS_PER_TX) {
		const batch = firms.slice(start, start + FIRMS_PER_TX);
		await withRetry(`fund firms ${start}..${start + batch.length - 1}`, () =>
			fundBatch(connection, agent, mintKey, batch, start),
		);
	}
};
