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
	priceUnits: string;
	totalUnits: string;
	taskCount: number;
	targetLangs: string[];
};

export type OrderTask = {
	taskId: string;
	targetLang: string;
	publicState: string;
	result: string | null;
	reason: string | null;
	claimDeadline: string;
	workDeadline: string | null;
};

export type Order = {
	orderId: string;
	tasks: OrderTask[];
};

export type GatewayClient = {
	createDraft: (token: string, input: DraftInput) => Promise<Parsed<Draft>>;
	getDraft: (draftId: string) => Promise<Parsed<DraftStatus>>;
	getOrder: (token: string, orderId: string) => Promise<Parsed<Order>>;
	approveTask: (token: string, taskId: string) => Promise<Parsed<OrderTask>>;
	rejectTask: (
		token: string,
		taskId: string,
		reason: string,
	) => Promise<Parsed<OrderTask>>;
};
