// Typed configuration. Money is bigint base units of a 6-decimal mint.

export type Network = `${string}:${string}`;

export enum Commitment {
	Confirmed = "confirmed",
	Finalized = "finalized",
}

export enum TimerMode {
	Video = "video",
	Public = "public",
}

export type Env = Record<string, string | undefined>;

// reason is public (503 body) and names no URL; detail goes to the server log only.
export type PreflightProblem = { reason: string; detail: string };

export type Parsed<T = unknown> =
	| { ok: true; value: T }
	| { ok: false; error: string };

// Chain, server and database settings shared by the gateway processes.
export type ConfigBase = {
	rpcUrl: string;
	network: Network;
	facilitatorUrl: string;
	usdcMint: string;
	holdKeypairPath: string;
	port: number;
	dbPath: string;
	commitment: Commitment;
};

// Web Push keys (ADR 0029); null turns push off.
export type Vapid = { publicKey: string; privateKey: string; subject: string };

export type ConfigV2 = {
	taskPriceUnits: bigint;
	timerMode: TimerMode;
	claimWindowSeconds: number;
	workWindowSeconds: number;
	linguistShareBps: bigint;
	agencyShareBps: bigint;
	feeShareBps: bigint;
	feeWallet: string;
	publicBaseUrl: string;
	mcpPublicUrl: string;
	draftTtlSeconds: number;
	sessionTtlSeconds: number;
	nonceTtlSeconds: number;
	webDistDir: string;
	vapid: Vapid | null;
};

export type Config = ConfigBase & ConfigV2;
