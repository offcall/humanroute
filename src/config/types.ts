// Typed configuration. Money is bigint base units of a 6-decimal mint.

export type Network = `${string}:${string}`;

export enum Commitment {
	Confirmed = "confirmed",
	Finalized = "finalized",
}

export type Env = Record<string, string | undefined>;

// reason is public (503 body) and names no URL; detail goes to the server log only.
export type PreflightProblem = { reason: string; detail: string };

export type Parsed<T = unknown> =
	| { ok: true; value: T }
	| { ok: false; error: string };

export type Config = {
	rpcUrl: string;
	network: Network;
	facilitatorUrl: string;
	usdcMint: string;
	holdKeypairPath: string;
	expertKeypairPath: string;
	expertWallet: string;
	priceUnits: bigint;
	feeBps: bigint;
	releaseUnits: bigint;
	refundUnits: bigint;
	slaSeconds: number;
	inboxToken: string;
	statusSecret: string;
	port: number;
	dbPath: string;
	commitment: Commitment;
};
