// TaskView for the API (api.md): ISO deadlines, public state from the task and its transfer.
import { TransferStatus } from "../store/index.js";
import type { TaskTransfer } from "./deps.js";
import {
	firmNameOf,
	type PartyPorts,
	partiesOf,
	type TaskParties,
} from "./parties.js";
import { transferView } from "./transfer.js";
import { PublicState, type Task, TaskState } from "./types.js";

const iso = (millis: number): string => new Date(millis).toISOString();

export const publicState = (
	task: Task,
	transfer: TaskTransfer | null,
): PublicState => {
	const confirmed = transfer?.status === TransferStatus.Confirmed;
	switch (task.state) {
		case TaskState.Open:
			return PublicState.Open;
		case TaskState.Claimed:
			return PublicState.Claimed;
		case TaskState.Submitted:
			return PublicState.Submitted;
		case TaskState.Approved:
			return confirmed ? PublicState.PaidOut : PublicState.PayingOut;
		case TaskState.Rejected:
		case TaskState.ExpiredUnclaimed:
		case TaskState.ExpiredLate:
			return confirmed ? PublicState.Refunded : PublicState.Refunding;
	}
};

export const toView = (
	task: Task,
	transfer: TaskTransfer | null,
	parties: TaskParties,
	forClaimer: boolean,
) => ({
	taskId: task.id,
	orderId: task.orderId,
	...parties,
	sourceLang: task.sourceLang,
	targetLang: task.targetLang,
	text: task.text,
	draft: task.draft,
	result: task.result,
	state: task.state,
	publicState: publicState(task, transfer),
	priceUnits: task.priceUnits.toString(),
	claimDeadline: iso(task.claimDeadline),
	workDeadline: task.workDeadline === null ? null : iso(task.workDeadline),
	reason: task.reason,
	transfer: transfer === null ? null : transferView(transfer, forClaimer),
});

export type TaskView = ReturnType<typeof toView>;

export type ViewPorts = PartyPorts & {
	transferOf: (taskId: string) => TaskTransfer | null;
};

// forClaimer: the caller is the task's linguist, who also sees their share (earnedUnits).
export const viewOf = (
	ports: ViewPorts,
	task: Task,
	forClaimer = false,
): TaskView =>
	toView(task, ports.transferOf(task.id), partiesOf(ports, task), forClaimer);

export const boardItem = (ports: PartyPorts, task: Task) => ({
	taskId: task.id,
	firmName: firmNameOf(ports, task),
	sourceLang: task.sourceLang,
	targetLang: task.targetLang,
	priceUnits: task.priceUnits.toString(),
	claimDeadline: iso(task.claimDeadline),
	text: task.text,
	draft: task.draft,
});
