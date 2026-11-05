import { type Task, TaskState } from "../shared";
import { InFlightTime } from "./InFlightTime";
import { SettledTime } from "./SettledTime";
import { Countdown, TimeWord } from "./TimeBits";

const SETTLED = new Set(["paid_out", "refunded"]);

type Props = { task: Task; now: number };

// Time column: countdown while running, "On time" when delivered, then where the money went.
export const TimeCell = ({ task, now }: Props) => {
	if (task.state === TaskState.Open) {
		return (
			<Countdown
				deadline={task.claimDeadline}
				now={now}
				caption="then refund to you · "
			/>
		);
	}
	if (task.state === TaskState.Claimed) {
		return task.workDeadline === null ? (
			<div className="cell-time" />
		) : (
			<Countdown deadline={task.workDeadline} now={now} caption="left · due " />
		);
	}
	if (task.state === TaskState.Submitted) {
		return <TimeWord word="On time" line="delivered" />;
	}

	return SETTLED.has(task.publicState) ? (
		<SettledTime task={task} />
	) : (
		<InFlightTime task={task} />
	);
};
