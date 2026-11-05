// A draft's current state for get_task and wait_task, and its fingerprint for change detection.
import type { GatewayClient, Order, Parsed, Snapshot } from "./types.js";

// Final public states (src/tasks/types.ts PublicState); mcp/ cannot import src/ values.
const SETTLED_STATES = ["paid_out", "refunded"];

export const readStatus = async (
	client: GatewayClient,
	token: string,
	draftId: string,
): Promise<Parsed<Snapshot>> => {
	const status = await client.getDraft(draftId);
	if (!status.ok) {
		return status;
	}
	const { orderId } = status.value;
	if (orderId === undefined) {
		return { ok: true, value: { status: status.value, order: undefined } };
	}
	const order = await client.getOrder(token, orderId);

	return order.ok
		? { ok: true, value: { status: status.value, order: order.value } }
		: order;
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
	order?.tasks.every((task) => SETTLED_STATES.includes(task.publicState)) ===
	true;

export const progressLine = ({ order }: Snapshot): string =>
	order === undefined
		? "awaiting payment"
		: order.tasks
				.map((task) => `${task.targetLang}: ${task.publicState}`)
				.join(", ");
