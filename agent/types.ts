// Types for the demo agent and the gateway JSON it parses.
export type Parsed<T = unknown> =
	| { ok: true; value: T }
	| { ok: false; error: string };

export type Sentence = {
	id: string;
	text: string;
	draft: string;
	confidence: number;
};

export type Accepted = {
	jobId: string;
	statusUrl: string;
	statusToken: string;
};

export type Transfer = {
	kind: string;
	status: string;
	txSig: string | null;
	attempts?: number;
	lastError?: string | null;
};

export type JobStatus = {
	state: string;
	refundReason: string | null;
	viewed: boolean;
	answer: string | null;
	transfers: Transfer[];
};

export type EscalateInput = {
	gatewayUrl: string;
	keypairPath: string;
	text: string;
	sourceLang: string;
	targetLang: string;
	draft?: string;
};

export type Escalation = {
	jobId: string;
	statusToken: string;
	/** Absolute status URL with ?token= set. */
	statusUrl: string;
	payTx: string | null;
	payer: string | null;
};

export type Settlement = {
	payTx: string | null;
	payer: string | null;
};

export type PollOptions = {
	intervalMs?: number;
	timeoutMs?: number;
	onTick?: (status: JobStatus) => void;
};
