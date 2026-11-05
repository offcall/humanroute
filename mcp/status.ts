// A draft's current state for get_task and wait_task, and its fingerprint for change detection.
import {
	type DraftStatus,
	type GatewayClient,
	type Order,
	type Parsed,
	PublicState,
	type Snapshot,
} from "./types.js";

const SETTLED_STATES = new Set([PublicState.PaidOut, PublicState.Refunded]);

const withOrder = async (
	client: GatewayClient,
	token: string,
	status: DraftStatus,
	cancel: AbortSignal,
): Promise<Parsed<Snapshot>> => {
	if (status.orderId === undefined) {
		return { ok: true, value: { status, order: undefined } };
	}
	const order = await client.getOrder(token, status.orderId, cancel);

	return order.ok ? { ok: true, value: { status, order: order.value } } : order;
};

// A paid draft never changes again, so a caller that has seen it paid passes it and skips getDraft.
export const readStatus = async (
	client: GatewayClient,
	token: string,
	draftId: string,
	paid: DraftStatus | undefined,
	cancel: AbortSignal,
): Promise<Parsed<Snapshot>> => {
	if (paid !== undefined) {
		return withOrder(client, token, paid, cancel);
	}
	const status = await client.getDraft(draftId, cancel);

	return status.ok ? withOrder(client, token, status.value, cancel) : status;
};

// "draft" before payment, then e.g. "paid;de=claimed;fr=open".
export const fingerprint = ({ status, order }: Snapshot): string => {
	if (order === undefined) {
		return status.state;
	}
	const langs = order.tasks
		.map((task) => `${task.targetLang}=${task.publicState}`)
		.sort();

	return [status.state, ...langs].join(";");
};

const AWAITING = "awaiting payment";

// Human-readable changes from a seen fingerprint to the current snapshot, e.g. "de: claimed -> submitted".
export const changesSince = (seen: string, snapshot: Snapshot): string[] => {
	const [state, ...langs] = seen.split(";");
	const prior = new Map(
		langs.map((part) => {
			const cut = part.indexOf("=");
			return [part.slice(0, cut), part.slice(cut + 1)];
		}),
	);
	const lines =
		state === snapshot.status.state
			? []
			: [`order: ${state} -> ${snapshot.status.state}`];
	for (const task of snapshot.order?.tasks ?? []) {
		const before = prior.get(task.targetLang) ?? AWAITING;
		if (before !== task.publicState) {
			lines.push(`${task.targetLang}: ${before} -> ${task.publicState}`);
		}
	}

	return lines;
};

export const isSettled = (order: Order | undefined): boolean =>
	order?.tasks.every((task) => SETTLED_STATES.has(task.publicState)) === true;

export const progressLine = ({ order }: Snapshot): string =>
	order === undefined
		? AWAITING
		: order.tasks
				.map((task) => `${task.targetLang}: ${task.publicState}`)
				.join(", ");
