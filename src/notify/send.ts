// New tasks -> one push per task and subscription of every linguist in the pair (ADR 0029).
// Payload: ids, pair and deadline only, never the text or the price.
import { findLinguistIdsByPair } from "../accounts/index.js";
import { removeSubscription, subscriptionsOf } from "./repo.js";
import type {
	NotifyDeps,
	PushSender,
	PushTarget,
	TaskNotice,
} from "./types.js";

const deliver = async (
	deps: NotifyDeps,
	sender: PushSender,
	target: PushTarget,
	task: TaskNotice,
): Promise<void> => {
	const payload = JSON.stringify({
		taskId: task.taskId,
		source: task.source,
		target: task.target,
		claimDeadline: new Date(task.claimDeadline).toISOString(),
	});
	const outcome = await sender(target, payload, deps.claimWindowSeconds);
	if (outcome.kind === "gone") {
		removeSubscription(deps.database, target.endpoint);
	}
	if (outcome.kind === "failed") {
		deps.log(
			`push failed task ${task.taskId} status ${outcome.status ?? "?"} ${outcome.reason}`,
		);
	}
};

export const notifyNewTasks =
	(deps: NotifyDeps) =>
	async (tasks: TaskNotice[]): Promise<void> => {
		const { sender } = deps;
		if (sender === null) {
			return;
		}

		for (const task of tasks) {
			const pair = { source: task.source, target: task.target };
			const linguistIds = findLinguistIdsByPair(deps.database, pair);
			const targets = subscriptionsOf(deps.database, linguistIds);
			await Promise.all(
				targets.map((target) => deliver(deps, sender, target, task)),
			);
		}
	};
