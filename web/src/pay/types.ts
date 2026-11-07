import type { VersionedTransaction } from "@solana/web3.js";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export enum DraftState {
	Draft = "draft",
	Paid = "paid",
	Orphaned = "orphaned",
	Settling = "settling",
}

export type DraftView = {
	draftId: string;
	state: DraftState;
	sourceLang: string;
	targetLangs: string[];
	taskCount: number;
	priceUnits: bigint;
	totalUnits: bigint;
	payTo: string;
	mint: string;
	network: string;
	orderId?: string;
	// Only when orphaned: the settle transaction, null when unknown (ADR 0042).
	payTx?: string | null;
};

export type PayResult = {
	orderId: string;
	taskIds: string[];
	payTx: string;
};

export type PhantomProvider = {
	connect: () => Promise<{ publicKey: { toString: () => string } }>;
	signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
};
