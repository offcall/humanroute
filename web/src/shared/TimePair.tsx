import "./TimePair.css";
import { Icon, IconName } from "./Icon";
import { formatClock, formatLeft, toMs } from "./useClock";

export const URGENT_MS = 30_000;

type Props = {
	deadline: string;
	// server now from useClock
	now: number;
	// "left to deliver", "then refund to you"
	caption?: string;
};

// "0:42 · due 10:14:03"; under 30 s: red, alarm icon and words
export const TimePair = ({ deadline, now, caption }: Props) => {
	const leftMs = toMs(deadline) - now;
	const urgent = leftMs > 0 && leftMs < URGENT_MS;
	const prefix = caption === undefined ? "" : `${caption} · `;

	return (
		<span className={urgent ? "time-pair is-urgent" : "time-pair"}>
			<b>
				{urgent ? <Icon name={IconName.Alarm} size={18} /> : null}
				{formatLeft(leftMs)}
			</b>{" "}
			{urgent ? <span className="urgent urgent--sm">Under 30 s </span> : null}
			<span className="time-pair__due">
				{prefix}due {formatClock(deadline)}
			</span>
		</span>
	);
};
