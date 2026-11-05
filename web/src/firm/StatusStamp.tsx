import { formatClock, Stamp, StampKind, type Task, TaskState } from "../shared";

// Large PAID stamp with the confirmation time, or LATE for a late refund.
export const StatusStamp = ({ task }: { task: Task }) => {
	const confirmedAt = task.transfer === null ? null : task.transfer.confirmedAt;
	if (task.publicState === "paid_out") {
		const note = confirmedAt === null ? "" : formatClock(confirmedAt);

		return <Stamp kind={StampKind.Paid} note={note} still large />;
	}
	if (task.publicState === "refunded" && task.state === TaskState.ExpiredLate) {
		return <Stamp kind={StampKind.Late} note="refunded" still large />;
	}

	return null;
};
