// Reads and validates the environment for scripts/setup-wallets.ts.
import { PublicKey } from "@solana/web3.js";
import type { WalletEnv } from "./types.js";

const DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

const env = (name: string, fallback: string): string => {
	const value = process.env[name];
	return value === undefined || value === "" ? fallback : value;
};

const parseMint = (raw: string): PublicKey => {
	try {
		return new PublicKey(raw);
	} catch {
		throw new Error(`USDC_MINT is not a valid public key: ${raw}`);
	}
};

const parseRpcUrl = (raw: string): string => {
	const url = new URL(raw);
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error(`RPC_URL must be http(s): ${raw}`);
	}
	return raw;
};

export const readWalletEnv = (): WalletEnv => ({
	rpcUrl: parseRpcUrl(env("RPC_URL", "https://api.devnet.solana.com")),
	usdcMint: parseMint(env("USDC_MINT", DEVNET_USDC)),
	paths: {
		hold: env("HOLD_KEYPAIR_PATH", "keys/hold.json"),
		agent: env("AGENT_KEYPAIR_PATH", "keys/agent.json"),
	},
	testMintPath: "keys/test-mint.json",
});
