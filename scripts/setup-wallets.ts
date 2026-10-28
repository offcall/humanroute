// Idempotent devnet wallet setup.
// - hold/agent keypairs (paths from HOLD_/AGENT_KEYPAIR_PATH), created once
// - airdrops devnet SOL to hold and agent when below 0.5 SOL
// - creates the USDC_MINT ATAs for hold and agent (hold pays rent)
// - --fallback-mint: creates an own 6-decimal SPL mint (authority = hold), mints 100 to the agent
//   and records it in keys/test-mint.json (deviation from real devnet USDC)
import { Connection, type PublicKey } from "@solana/web3.js";
import { formatUnits, tokenBalance } from "./wallets/balances.js";
import { readWalletEnv } from "./wallets/env.js";
import { loadOrCreateKeypair } from "./wallets/keypairs.js";
import { errorMessage } from "./wallets/retry.js";
import { ensureSol, lamports } from "./wallets/sol.js";
import {
	ensureAta,
	fundFromTestMint,
	loadOrCreateTestMint,
} from "./wallets/tokens.js";
import type { Wallets } from "./wallets/types.js";

const printSummary = async (
	conn: Connection,
	wallets: Wallets,
	usdc: PublicKey,
	testMint: PublicKey | null,
) => {
	const fmt = (balance: bigint | null) =>
		balance === null ? "no ATA" : formatUnits(balance);
	for (const [name, keypair] of Object.entries(wallets)) {
		const sol = formatUnits(await lamports(conn, keypair.publicKey), 9);
		const usdcBal = fmt(await tokenBalance(conn, usdc, keypair.publicKey));
		const extra = testMint
			? `  testMint=${fmt(await tokenBalance(conn, testMint, keypair.publicKey))}`
			: "";
		console.log(
			`${name.padEnd(6)} ${keypair.publicKey.toBase58()}  SOL=${sol}  USDC=${usdcBal}${extra}`,
		);
	}
	if (testMint) {
		console.log(`test mint (deviation): ${testMint.toBase58()}`);
	}
};

const main = async (): Promise<void> => {
	const cfg = readWalletEnv();
	const fallback = process.argv.includes("--fallback-mint");
	const conn = new Connection(cfg.rpcUrl, "confirmed");
	const wallets: Wallets = {
		hold: loadOrCreateKeypair(cfg.paths.hold),
		agent: loadOrCreateKeypair(cfg.paths.agent),
	};

	await ensureSol(conn, "hold", wallets.hold.publicKey);
	await ensureSol(conn, "agent", wallets.agent.publicKey);
	if ((await lamports(conn, wallets.hold.publicKey)) === 0n) {
		throw new Error("hold wallet has no SOL; cannot create ATAs");
	}

	const testMint = await loadOrCreateTestMint(
		conn,
		wallets.hold,
		cfg.testMintPath,
		fallback,
	);
	for (const keypair of Object.values(wallets)) {
		await ensureAta(conn, wallets.hold, cfg.usdcMint, keypair.publicKey);
		if (testMint) {
			await ensureAta(conn, wallets.hold, testMint, keypair.publicKey);
		}
	}
	if (testMint && fallback) {
		await fundFromTestMint(
			conn,
			wallets.hold,
			testMint,
			wallets.agent.publicKey,
		);
	}

	console.log(`\nRPC ${cfg.rpcUrl}`);
	await printSummary(conn, wallets, cfg.usdcMint, testMint);
	console.log(
		"demo wallets come from Phantom, not this script: firm (funded with USDC), agency, linguist; FEE_WALLET gets the fee share",
	);
};

main().catch((err: unknown) => {
	console.error(errorMessage(err));
	process.exit(1);
});
