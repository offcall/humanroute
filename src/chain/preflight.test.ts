import {
	getAssociatedTokenAddressSync,
	MINT_SIZE,
	MintLayout,
	TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
	type AccountInfo,
	Connection,
	Keypair,
	PublicKey,
} from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { Commitment } from "../config/index.js";
import { preflight } from "./preflight.js";
import type { SolanaOptions } from "./types.js";

const hold = Keypair.fromSeed(new Uint8Array(32).fill(1));
const mint = Keypair.fromSeed(new Uint8Array(32).fill(9)).publicKey;
const holdAta = getAssociatedTokenAddressSync(mint, hold.publicKey);

const opts: SolanaOptions = {
	rpcUrl: "http://rpc.invalid",
	mint: mint.toBase58(),
	commitment: Commitment.Confirmed,
	hold,
};

const mintAccount = (decimals: number): AccountInfo<Buffer> => {
	const data = Buffer.alloc(MINT_SIZE);
	MintLayout.encode(
		{
			mintAuthorityOption: 0,
			mintAuthority: PublicKey.default,
			supply: 0n,
			decimals,
			isInitialized: true,
			freezeAuthorityOption: 0,
			freezeAuthority: PublicKey.default,
		},
		data,
	);
	return { data, owner: TOKEN_PROGRAM_ID, lamports: 1, executable: false };
};

type Chain = { lamports: number; decimals: number; holdAta: boolean };

const healthy: Chain = { lamports: 50_000_000, decimals: 6, holdAta: true };

const stub = (chain: Chain) => {
	const conn = new Connection(opts.rpcUrl);
	vi.spyOn(conn, "getBalance").mockResolvedValue(chain.lamports);
	vi.spyOn(conn, "getAccountInfo").mockImplementation(async (address) => {
		if (address.equals(mint)) {
			return mintAccount(chain.decimals);
		}
		return address.equals(holdAta) && chain.holdAta ? mintAccount(0) : null;
	});
	return conn;
};

const reasons = async (conn: Connection) =>
	(await preflight(conn, opts)).map((problem) => problem.reason);

describe("NEW-04 preflight reports low hold SOL, wrong mint decimals, missing hold ATA and RPC failure", () => {
	it("is ready at exactly 50000000 lamports, a 6-decimal mint and a hold ATA", async () => {
		expect(await reasons(stub(healthy))).toEqual([]);
	});

	it("reports 49999999 lamports as too little SOL", async () => {
		const conn = stub({ ...healthy, lamports: 49_999_999 });
		expect(await reasons(conn)).toEqual([
			"hold wallet needs at least 0.05 SOL for fees",
		]);
	});

	it("aggregates distinct problems", async () => {
		const conn = stub({ lamports: 0, decimals: 9, holdAta: false });
		expect(await reasons(conn)).toEqual([
			"hold wallet needs at least 0.05 SOL for fees",
			"mint has 9 decimals, expected 6",
			"hold wallet has no token account for the mint",
		]);
	});

	it("reports an RPC failure", async () => {
		const conn = new Connection(opts.rpcUrl);
		vi.spyOn(conn, "getBalance").mockRejectedValue(new Error("fetch failed"));

		const problems = await preflight(conn, opts);
		expect(problems).toEqual([
			{
				reason: "rpc check failed",
				detail: "RPC http://rpc.invalid check failed: fetch failed",
			},
		]);
	});
});
