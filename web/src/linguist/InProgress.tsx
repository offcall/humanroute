import {
	Announcer,
	formatClock,
	formatLeft,
	formatUsdc,
	LangPair,
	navigate,
	pairLabel,
	type Task,
	toMs,
	URGENT_MS,
	useClock,
	wordsLabel,
} from "../shared";
import { spokenLeft } from "./jobLabel";
import { TAB_PATH, Tab } from "./tabs";
import "./board-big.css";

// The soonest own claimed task: silent timer, announcer at 60 / 30 / 10 s, Continue.
export const InProgress = ({ task }: { task: Task }) => {
	const now = useClock();
	const deadline = task.workDeadline ?? task.claimDeadline;
	const leftMs = toMs(deadline) - now;
	const spoken = `${spokenLeft(leftMs)} left`;
	const label = `Continue translation: ${pairLabel(task.sourceLang, task.targetLang)}, ${task.firmName}, ${spoken}`;

	return (
		<>
			<div className="hero-time">
				<p
					className={leftMs < URGENT_MS ? "num-hero is-urgent" : "num-hero"}
					role="timer"
					aria-label={`${spoken} to deliver`}
				>
					{formatLeft(leftMs)}
				</p>
				<p className="hero-caption">
					left to deliver · due {formatClock(deadline)}
				</p>
			</div>
			<Announcer leftMs={leftMs} subject="to deliver" />
			<div className="job-meta">
				<b>
					<LangPair source={task.sourceLang} target={task.targetLang} compact />{" "}
					· {formatUsdc(task.priceUnits)}
				</b>
				<span>
					<b>{task.firmName}</b>
					{task.agency === null ? null : (
						<>
							{" "}
							→ <b>{task.agency.name}</b>
						</>
					)}
					<span className="job-meta__words">{wordsLabel(task.text)}</span>
				</span>
			</div>
			<button
				type="button"
				className="btn btn--primary btn--block btn--lg"
				aria-label={label}
				onClick={() =>
					navigate(`${TAB_PATH[Tab.Tasks]}/${encodeURIComponent(task.taskId)}`)
				}
			>
				Continue translation
			</button>
		</>
	);
};
