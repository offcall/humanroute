// SolanaClient: the only way the gateway touches the chain. Mockable; web3.js implementation in client.ts.
import type { Keypair, PublicKey } from "@solana/web3.js";
import type { Commitment, PreflightProblem } from "../config/index.js";

// retryable: safe to try again later (nothing reached the network).
// final: will not succeed without an operator (no recipient token account, no funds).
// ambiguous: the transaction may have been forwarded; decide only by status and blockhash expiry.
export enum ErrorKind {
	Retryable = "retryable",
	Final = "final",
	Ambiguous = "ambiguous",
}

// prepare: nothing was broadcast yet. send: the transaction may have reached a leader.
export enum Phase {
	Prepare = "prepare",
	Send = "send",
}

export type ChainError = { kind: ErrorKind; message: string };
export type ChainResult<T = unknown> =
	| { ok: true; value: T }
	| { ok: false; error: ChainError };

export type SolanaOptions = {
	rpcUrl: string;
	mint: string;
	commitment: Commitment;
	hold: Keypair;
};

export type TransferParams = {
	hold: Keypair;
	mint: PublicKey;
	decimals: number;
	blockhash: string;
	lastValidBlockHeight: number;
};

export type PayoutLeg = {
	ownerWallet: string;
	amountUnits: bigint;
};

export type PayoutRequest = {
	legs: PayoutLeg[];
	memo: string;
};

export type SignedTransfer = {
	signature: string;
	blockhash: string;
	lastValidBlockHeight: number;
	bytes: Uint8Array;
};

// unknown: the RPC has no record (searchTransactionHistory = true).
// pending: seen, but below the configured commitment.
export type SignatureStatus =
	| { state: "unknown" }
	| { state: "pending" }
	| { state: "confirmed" }
	| { state: "failed"; error: string };

// A wallet's associated token account for the configured mint (ADR 0036).
export type TokenAccount =
	| { exists: false; address: string }
	| {
			exists: true;
			address: string;
			amount: bigint;
			delegate: string | null;
			delegatedAmount: bigint;
	  };

export type RecentBlockhash = {
	blockhash: string;
	lastValidBlockHeight: number;
};

export type SolanaClient = {
	holdAddress: string;
	signPayout(req: PayoutRequest): Promise<ChainResult<SignedTransfer>>;
	broadcast(bytes: Uint8Array): Promise<ChainResult<string>>;
	signatureStatus(signature: string): Promise<ChainResult<SignatureStatus>>;
	blockHeight(): Promise<ChainResult<number>>;
	// Signature of a successful hold transaction whose memo contains `memo`, or null.
	findMemo(memo: string): Promise<ChainResult<string | null>>;
	tokenAccount(owner: string): Promise<ChainResult<TokenAccount>>;
	latestBlockhash(): Promise<ChainResult<RecentBlockhash>>;
	// Problems that should stop the gateway from taking payments; empty when ready.
	preflight(): Promise<PreflightProblem[]>;
};
