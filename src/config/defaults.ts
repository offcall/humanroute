// Env defaults: devnet endpoints, devnet USDC, local key and database paths.
export const DEFAULTS: Record<string, string> = {
	RPC_URL: "https://api.devnet.solana.com",
	SOLANA_NETWORK: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
	FACILITATOR_URL: "https://x402.org/facilitator",
	USDC_MINT: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
	HOLD_KEYPAIR_PATH: "keys/hold.json",
	EXPERT_KEYPAIR_PATH: "keys/expert.json",
	PRICE_USDC: "0.50",
	FEE_PCT: "10",
	SLA_SECONDS: "60",
	PORT: "4021",
	DB_PATH: "data/humanroute.db",
	COMMITMENT: "confirmed",
};
