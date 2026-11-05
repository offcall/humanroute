import {
	languageName,
	SegBar,
	Stamp,
	StatusTag,
	statusOf,
	type Task,
} from "../shared";
import { outcomeText } from "./outcomeText";
import { PayoutLine } from "./PayoutLine";
import { TaskFacts } from "./TaskFacts";

type Props = { task: Task; todayUnits: bigint };

// Submitted / paying out / paid / rejected / late: read-only.
export const TaskOutcome = ({ task, todayUnits }: Props) => {
	const status = statusOf(task.state, task.publicState);
	const outcome = outcomeText(task, status, todayUnits);

	return (
		<>
			{outcome.tag ? (
				<div className="hero-stamp">
					<StatusTag status={status} large />
					{outcome.stamp === undefined ? null : (
						<Stamp kind={outcome.stamp.kind} note={outcome.stamp.note} large />
					)}
				</div>
			) : null}
			<p className="num-status">{outcome.title}</p>
			<p className="hero-caption">{outcome.caption}</p>
			<SegBar status={status} labelled />
			{task.transfer === null ? null : (
				<PayoutLine transfer={task.transfer} refund={status.crossed} />
			)}
			<TaskFacts task={task} />
			{task.result === null ? (
				<div className="stack stack--sm">
					<span className="field__label">
						{languageName(task.sourceLang)} · source
					</span>
					<p className="text-src" lang={task.sourceLang} dir="auto">
						{task.text}
					</p>
				</div>
			) : (
				<div className="stack stack--sm">
					<span className="field__label">
						{languageName(task.targetLang)} · delivered
					</span>
					<div className="result-box" lang={task.targetLang} dir="auto">
						{task.result}
					</div>
				</div>
			)}
		</>
	);
};
