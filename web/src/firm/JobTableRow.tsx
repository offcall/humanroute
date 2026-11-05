import {
	navigate,
	pairCodes,
	pairLabel,
	statusOf,
	type Task,
	TaskState,
	Who,
} from "../shared";
import { taskTitle, usdcNumber } from "./format";
import { StatusCell } from "./StatusCell";
import { TimeCell } from "./TimeCell";
import { TransferError } from "./TransferError";

type Props = { task: Task; now: number };

const executor = (task: Task): string => {
	if (task.agency === null) {
		return "no translator yet";
	}

	return task.translatorNo === null
		? task.agency.name
		: `${task.agency.name} translator #${task.translatorNo}`;
};

// One task; the pair link covers the row and opens the task detail.
export const JobTableRow = ({ task, now }: Props) => {
	const status = statusOf(task.state, task.publicState);
	const href = `/firm/jobs/${encodeURIComponent(task.orderId)}/${encodeURIComponent(task.targetLang)}`;
	const title = taskTitle(task.text);
	const label = [
		pairLabel(task.sourceLang, task.targetLang),
		title,
		executor(task),
		status.word.toLowerCase(),
		`${usdcNumber(task.priceUnits)} USDC`,
	].join(", ");
	const open = (event: React.MouseEvent) => {
		event.preventDefault();
		navigate(href);
	};

	return (
		<li
			className={status.final ? "jobs-table__row is-final" : "jobs-table__row"}
		>
			<StatusCell status={status} failed={task.transfer?.status === "failed"} />
			<div className="cell-pair">
				<a
					className="fb-row-link"
					href={href}
					aria-label={label}
					onClick={open}
				>
					<b>{pairCodes(task.sourceLang, task.targetLang)}</b>
				</a>
				<span>{title}</span>
			</div>
			<Who agency={task.agency} translatorNo={task.translatorNo} />
			<TimeCell task={task} now={now} />
			<div className="cell-amt">
				<b>{usdcNumber(task.priceUnits)}</b>
			</div>
			{task.state === TaskState.Rejected && task.reason !== null ? (
				<p className="fb-row-note">
					<span>Your reason</span>“{task.reason}”
				</p>
			) : null}
			<TransferError task={task} />
		</li>
	);
};
