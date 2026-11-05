// A draft's current state for get_task and wait_task, and its fingerprint for change detection.
import {
	type GatewayClient,
	type Order,
	type Parsed,
	PublicState,
	type Snapshot,
} from "./types.js";

const SETTLED_STATES = new Set([PublicState.PaidOut, PublicState.Refunded]);

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

// paying_out and refunding settle within seconds after a decision; waking Claude for them adds nothing.
const TRANSIENT_STATES = [PublicState.PayingOut, PublicState.Refunding];

export const onlyTransient = (changes: string[]): boolean =>
	changes.every((change) =>
		TRANSIENT_STATES.some((state) => change.endsWith(`-> ${state}`)),
	);

export const isSettled = (order: Order | undefined): boolean =>
	order?.tasks.every((task) => SETTLED_STATES.has(task.publicState)) === true;

export const progressLine = ({ order }: Snapshot): string =>
	order === undefined
		? AWAITING
		: order.tasks
				.map((task) => `${task.targetLang}: ${task.publicState}`)
				.join(", ");
