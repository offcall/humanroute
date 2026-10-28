export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export type Target = { targetLang: string; draft: string };

export type DraftInput = {
	text: string;
	sourceLang: string;
	targets: Target[];
};

export type Draft = {
	draftId: string;
	payUrl: string;
	priceUnits: string;
	totalUnits: string;
	taskCount: number;
};

export enum DraftState {
	Draft = "draft",
	Paid = "paid",
}

export type DraftStatus = {
	draftId: string;
	state: DraftState;
	orderId?: string;
	tasks?: unknown[];
};

export type GatewayClient = {
	createDraft: (token: string, input: DraftInput) => Promise<Parsed<Draft>>;
	getDraft: (draftId: string) => Promise<Parsed<DraftStatus>>;
};
