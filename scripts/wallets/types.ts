import type { Keypair, PublicKey } from "@solana/web3.js";

export type WalletPaths = {
	hold: string;
	agent: string;
	expert: string;
};

export type WalletEnv = {
	rpcUrl: string;
	usdcMint: PublicKey;
	paths: WalletPaths;
	testMintPath: string;
};

export type Wallets = Record<"hold" | "agent" | "expert", Keypair>;
