import { formatClock, type Task, TaskState } from "../shared";

// Why a decided task's money moves: "approved", "you rejected", "unclaimed by 10:13:45", "missed due 10:15:19". Pure.
export const reasonText = (task: Task): string => {
	switch (task.state) {
		case TaskState.Rejected:
			return "you rejected";
		case TaskState.ExpiredUnclaimed:
			return `unclaimed by ${formatClock(task.claimDeadline)}`;
		case TaskState.ExpiredLate:
			return task.workDeadline === null
				? "missed the due time"
				: `missed due ${formatClock(task.workDeadline)}`;
		default:
			return "approved";
	}
};
