import {
	navigate,
	pairCodes,
	pairLabel,
	Stamp,
	StatusTag,
	type Task,
} from "../shared";
import { linguistStatus, type RowTime, rowStamp, rowTime } from "./rowText";
import { TAB_PATH, Tab } from "./tabs";

type Props = { task: Task; time: RowTime };

// One button per task; the tx link lives on the task screen, never inside the row.
export const TaskRow = ({ task, time }: Props) => {
	const status = linguistStatus(task);
	const stamp = rowStamp(task);
	const when = rowTime(task, time);
	const sub = when === undefined ? task.firmName : `${task.firmName} · ${when}`;
	const label = [
		pairLabel(task.sourceLang, task.targetLang),
		sub.replace(" · ", ", "),
		stamp === undefined ? status.word : stamp.spoken,
	].join(", ");

	return (
		<button
			type="button"
			className="done-row"
			aria-label={label}
			onClick={() =>
				navigate(`${TAB_PATH[Tab.Tasks]}/${encodeURIComponent(task.taskId)}`)
			}
		>
			<span>
				<span className="done-row__pair">
					{pairCodes(task.sourceLang, task.targetLang).toUpperCase()}
				</span>
				<span className="done-row__sub">{sub}</span>
			</span>
			{stamp === undefined ? (
				<StatusTag status={status} />
			) : (
				<Stamp kind={stamp.kind} note={stamp.note} still />
			)}
		</button>
	);
};
