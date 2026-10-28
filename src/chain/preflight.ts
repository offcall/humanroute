// Hold wallet readiness: SOL for fees, a 6-decimal mint, a hold token account (ADR 0008).
import { getAssociatedTokenAddressSync, getMint } from "@solana/spl-token";
import { type Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { type PreflightProblem, USDC_DECIMALS } from "../config/index.js";
import { classify } from "./errors.js";
import { Phase, type SolanaOptions } from "./types.js";

// Enough SOL for fees and ATA rent for a payout (ADR 0024).
const MIN_HOLD_LAMPORTS = 50_000_000;

export const preflight = async (
	conn: Connection,
	opts: SolanaOptions,
): Promise<PreflightProblem[]> => {
	const problems: PreflightProblem[] = [];
	const hold = opts.hold.publicKey;
	const mint = new PublicKey(opts.mint);
	try {
		const lamports = await conn.getBalance(hold, opts.commitment);
		if (lamports < MIN_HOLD_LAMPORTS) {
			const sol = MIN_HOLD_LAMPORTS / LAMPORTS_PER_SOL;
			problems.push({
				reason: `hold wallet needs at least ${sol} SOL for fees`,
				detail: `hold ${hold.toBase58()} has ${lamports} lamports, needs at least ${sol} SOL for fees`,
			});
		}
		const info = await getMint(conn, mint, opts.commitment);
		if (info.decimals !== USDC_DECIMALS) {
			problems.push({
				reason: `mint has ${info.decimals} decimals, expected ${USDC_DECIMALS}`,
				detail: `mint ${opts.mint} has ${info.decimals} decimals, expected ${USDC_DECIMALS}`,
			});
		}
		const ata = getAssociatedTokenAddressSync(mint, hold);
		if (!(await conn.getAccountInfo(ata, opts.commitment))) {
			problems.push({
				reason: "hold wallet has no token account for the mint",
				detail: `hold ${hold.toBase58()} has no token account for mint ${opts.mint} (${ata.toBase58()})`,
			});
		}
	} catch (err) {
		problems.push({
			reason: "rpc check failed",
			detail: `RPC ${opts.rpcUrl} check failed: ${classify(err, Phase.Prepare).message}`,
		});
	}
	return problems;
};
