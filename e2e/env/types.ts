// What a global setup hands to the e2e suites (ADR 0038). Secrets are test-only keys made for one
// run on localnet; on devnet only the firm wallets funded by the setup.

export enum E2eMode {
	Localnet = "localnet",
	Devnet = "devnet",
}

export type E2eEnv = {
	mode: E2eMode;
	gatewayUrl: string;
	mcpUrl: string;
	rpcUrl: string;
	network: `${string}:${string}`;
	mint: string;
	holdAddress: string;
	feeWallet: string;
	// Facilitator fee payer; the gateway reads it from /supported.
	feePayer: string;
	// Funded firm wallets (64-byte secret keys), one per suite that needs its own firm.
	firms: number[][];
	claimWindowSeconds: number;
	workWindowSeconds: number;
	logDir: string;
	// Localnet: file of refused non-loopback connects (empty when the run stayed offline).
	egressLog: string | null;
	// Localnet: the gateway's env (without PORT, RPC_URL, DB_PATH), so a case can start its own.
	gatewayEnv: Record<string, string> | null;
};

declare module "vitest" {
	export interface ProvidedContext {
		e2e: E2eEnv;
	}
}
