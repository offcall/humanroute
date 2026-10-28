// TaskView for the API (api.md): ISO deadlines, public state from the task and its transfer.
import { TransferStatus } from "../store/index.js";
import type { TaskTransfer } from "./deps.js";
import { PublicState, type Task, TaskState } from "./types.js";

const EXPLORER = "https://explorer.solana.com/tx";

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

const transferView = (transfer: TaskTransfer) => ({
	...transfer,
	explorerUrl:
		transfer.payTx === null
			? null
			: `${EXPLORER}/${transfer.payTx}?cluster=devnet`,
});

export const toView = (task: Task, transfer: TaskTransfer | null) => ({
	taskId: task.id,
	orderId: task.orderId,
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
	transfer: transfer === null ? null : transferView(transfer),
});

export type TaskView = ReturnType<typeof toView>;

export const boardItem = (task: Task) => ({
	taskId: task.id,
	sourceLang: task.sourceLang,
	targetLang: task.targetLang,
	priceUnits: task.priceUnits.toString(),
	claimDeadline: iso(task.claimDeadline),
	text: task.text,
	draft: task.draft,
});
