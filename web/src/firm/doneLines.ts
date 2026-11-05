// Lines of the "All reviewed" screen. Pure.
import { formatClock, pairCodes, type Task, TaskState } from "../shared";

export const decisionLine = (task: Task): string => {
	const parts = [task.agency === null ? "" : task.agency.name];
	if (task.translatorNo !== null) {
		parts.push(`#${task.translatorNo}`);
	}
	parts.push(
		task.state === TaskState.Rejected
			? `rejected: ${task.reason ?? ""}`
			: "approved",
	);

	return parts.filter((part) => part !== "").join(" · ");
};

export const runningLine = (task: Task): string => {
	const pair = pairCodes(task.sourceLang, task.targetLang);
	if (task.state === TaskState.Open) {
		return `${pair} refunds at ${formatClock(task.claimDeadline)} if nobody claims it`;
	}

	return task.workDeadline === null
		? pair
		: `${pair} due ${formatClock(task.workDeadline)}`;
};
