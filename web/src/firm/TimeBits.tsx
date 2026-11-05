import {
	formatClock,
	formatLeft,
	Icon,
	IconName,
	toMs,
	URGENT_MS,
} from "../shared";

type CountdownProps = { deadline: string; now: number; caption: string };

// "0:42" over "left · due 10:14:03"; under 30 s red with the alarm icon
export const Countdown = ({ deadline, now, caption }: CountdownProps) => {
	const leftMs = toMs(deadline) - now;
	const urgent = leftMs > 0 && leftMs < URGENT_MS;

	return (
		<div className={urgent ? "cell-time is-urgent" : "cell-time"}>
			<b>
				{urgent ? <Icon name={IconName.Alarm} size={20} /> : null}
				{formatLeft(leftMs)}
			</b>
			<span>
				{caption}
				{formatClock(deadline)}
			</span>
		</div>
	);
};

// A word instead of a time: "Queued", "Retrying", "Stopped", "On time"
export const TimeWord = ({ word, line }: { word: string; line: string }) => (
	<div className="cell-time">
		<b className="fb-time-word">{word}</b>
		<span>{line}</span>
	</div>
);
