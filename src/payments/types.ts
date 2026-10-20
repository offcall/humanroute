import type { FacilitatorClient } from "@x402/core/server";
import type { Config } from "../config/index.js";
import type { OrphanReason, Store } from "../store/index.js";

export type PaymentsDeps = {
	store: Store;
	config: Config;
	facilitator: FacilitatorClient;
	payTo: string;
	preflightProblems: () => string[];
	now: () => number;
	newId: () => string;
	log: (msg: string) => void;
};

export type TranslateMeta = { clauseId?: string; confidence?: number };

export type TranslateBody = {
	text: string;
	sourceLang: string;
	targetLang: string;
	draft: string | null;
	meta: TranslateMeta | null;
};

export type PaymentsEnv = { Variables: { body: TranslateBody | undefined } };

export type Settlement = {
	transaction: string;
	payer: string;
	network: string;
};

export type SettleRejection = { reason: OrphanReason; error: string };

// Best-effort fields for the log line written before validation; null when absent.
export type SettlePeek = {
	transaction: string | null;
	payer: string | null;
	network: string | null;
};

export type RecordInput = {
	body: TranslateBody;
	paymentId: string | null;
	fingerprint: string;
	settlement: Settlement;
	slaSeconds: number;
	now: number;
	newId: () => string;
};

export type Accepted = {
	jobId: string;
	statusUrl: string;
	statusToken: string;
};
