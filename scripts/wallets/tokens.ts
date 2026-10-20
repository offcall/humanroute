// SPL token accounts (ATAs) and the optional fallback test mint.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
	createMint,
	getOrCreateAssociatedTokenAccount,
	mintTo,
} from "@solana/spl-token";
import { type Connection, type Keypair, PublicKey } from "@solana/web3.js";
import { DECIMALS, formatUnits } from "./balances.js";
import { retry } from "./retry.js";

/** 100 tokens with 6 decimals, minted to the agent on a fresh fallback mint. */
const TEST_MINT_FUNDING = 100_000_000n;

export const ensureAta = (
	conn: Connection,
	payer: Keypair,
	mint: PublicKey,
	owner: PublicKey,
) =>
	retry(`ATA ${owner.toBase58()}`, () =>
		getOrCreateAssociatedTokenAccount(conn, payer, mint, owner),
	);

const parseTestMintFile = (path: string): PublicKey => {
	const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (
		typeof raw !== "object" ||
		raw === null ||
		!("mint" in raw) ||
		typeof raw.mint !== "string"
	) {
		throw new Error(`${path}: expected {"mint": "<base58>"}`);
	}
	return new PublicKey(raw.mint);
};

/** Existing test mint from the file, a new one when `create` is set, otherwise null. */
export const loadOrCreateTestMint = async (
	conn: Connection,
	hold: Keypair,
	path: string,
	create: boolean,
): Promise<PublicKey | null> => {
	if (existsSync(path)) {
		return parseTestMintFile(path);
	}
	if (!create) {
		return null;
	}
	const mint = await retry("createMint", () =>
		createMint(conn, hold, hold.publicKey, null, DECIMALS),
	);
	writeFileSync(
		path,
		JSON.stringify({
			mint: mint.toBase58(),
			decimals: DECIMALS,
			authority: "hold",
		}),
	);
	console.log(`created test mint ${mint.toBase58()}`);
	return mint;
};

export const fundFromTestMint = async (
	conn: Connection,
	hold: Keypair,
	mint: PublicKey,
	owner: PublicKey,
) => {
	const ata = await ensureAta(conn, hold, mint, owner);
	if (ata.amount !== 0n) {
		return;
	}
	const sig = await retry("mintTo", () =>
		mintTo(conn, hold, mint, ata.address, hold, TEST_MINT_FUNDING),
	);
	console.log(
		`minted ${formatUnits(TEST_MINT_FUNDING)} test tokens to ${owner.toBase58()}: ${sig}`,
	);
};
