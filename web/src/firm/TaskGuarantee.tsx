import {
	formatClock,
	formatLeft,
	navigate,
	type Task,
	TaskState,
	toMs,
} from "../shared";

const goReview = (event: React.MouseEvent) => {
	event.preventDefault();
	navigate("/firm/review");
};

const Refund = ({
	deadline,
	now,
	when,
}: {
	deadline: string;
	now: number;
	when: string;
}) => (
	<p className="guarantee">
		<span>
			Auto-refund at <b>{formatClock(deadline)}</b> {when} ·{" "}
			<b>{formatLeft(toMs(deadline) - now)} left</b>
		</span>
	</p>
);

// The promise for this task: when it refunds, or what happened to it.
export const TaskGuarantee = ({ task, now }: { task: Task; now: number }) => {
	switch (task.state) {
		case TaskState.Open:
			return (
				<Refund
					deadline={task.claimDeadline}
					now={now}
					when="if nobody claims it"
				/>
			);
		case TaskState.Claimed:
			return task.workDeadline === null ? null : (
				<Refund
					deadline={task.workDeadline}
					now={now}
					when="if there is no valid answer"
				/>
			);
		case TaskState.Submitted:
			return (
				<p className="guarantee fb-status-row">
					<span>Delivered on time. It waits for your review.</span>
					<a
						className="btn btn--primary btn--xs"
						href="/firm/review"
						onClick={goReview}
					>
						Review
					</a>
				</p>
			);
		case TaskState.Approved:
			return <p className="guarantee">Delivered on time. You approved it.</p>;
		case TaskState.Rejected:
			return (
				<p className="guarantee">
					You rejected it: “{task.reason ?? ""}”. The money goes back to you.
				</p>
			);
		case TaskState.ExpiredLate:
			return (
				<p className="guarantee">
					No valid answer by the due time, so the money goes back to you.
				</p>
			);
		default:
			return (
				<p className="guarantee">
					Nobody claimed it in time, so the money goes back to you.
				</p>
			);
	}
};
