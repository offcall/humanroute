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
): Promise<Parsed<Snapshot>> => {
	if (status.orderId === undefined) {
		return { ok: true, value: { status, order: undefined } };
	}
	const order = await client.getOrder(token, status.orderId);

	return order.ok ? { ok: true, value: { status, order: order.value } } : order;
};

// A paid draft never changes again, so a caller that has seen it paid passes it and skips getDraft.
export const readStatus = async (
	client: GatewayClient,
	token: string,
	draftId: string,
	paid?: DraftStatus,
): Promise<Parsed<Snapshot>> => {
	if (paid !== undefined) {
		return withOrder(client, token, paid);
	}
	const status = await client.getDraft(draftId);

	return status.ok ? withOrder(client, token, status.value) : status;
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

export const isSettled = (order: Order | undefined): boolean =>
	order?.tasks.every((task) => SETTLED_STATES.has(task.publicState)) === true;

export const progressLine = ({ order }: Snapshot): string =>
	order === undefined
		? "awaiting payment"
		: order.tasks
				.map((task) => `${task.targetLang}: ${task.publicState}`)
				.join(", ");
