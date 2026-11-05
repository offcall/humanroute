import { Avatar, pairCodes, type Task, TaskState } from "../shared";
import { useExecutor } from "./useExecutor";

const RUNNING = new Set([TaskState.Open, TaskState.Claimed]);

const subLine = (task: Task, pairs: string[]): string => {
	const parts: string[] = [];
	if (task.translatorNo !== null) {
		parts.push(`translator #${task.translatorNo}`);
	}
	if (pairs.length > 0) {
		parts.push(`works ${pairs.join(", ")}`);
	}

	return parts.join(" · ");
};

// Executing card: agency, translator #N, the claimer's pairs and the agency rating.
export const Executing = ({ task }: { task: Task }) => {
	const agency = task.agency;
	const { pairs, rating } = useExecutor(
		task.taskId,
		agency === null ? null : agency.id,
	);
	if (agency === null) {
		return (
			<div className="exec exec--none">
				<Avatar name={null} />
				<div>
					<span className="kicker">Executing</span>
					<b className="exec__name">No translator yet</b>
				</div>
			</div>
		);
	}
	const pairCodesList = (pairs ?? []).map((pair) =>
		pairCodes(pair.source, pair.target),
	);

	return (
		<div className="exec">
			<Avatar name={agency.name} />
			<div>
				<span className="kicker">
					{RUNNING.has(task.state) ? "Executing" : "Translated by"}
				</span>
				<b className="exec__name">{agency.name}</b>
				<p className="exec__sub">{subLine(task, pairCodesList)}</p>
			</div>
			{rating === undefined ? null : (
				<dl className="stats">
					<div>
						<dt>Rating</dt>
						<dd>{rating.ratingPct === null ? "—" : `${rating.ratingPct}%`}</dd>
					</div>
					<div>
						<dt>Approved</dt>
						<dd>{rating.approved}</dd>
					</div>
					<div>
						<dt>Rejected</dt>
						<dd>{rating.rejected}</dd>
					</div>
					<div>
						<dt>Late</dt>
						<dd>{rating.late}</dd>
					</div>
				</dl>
			)}
		</div>
	);
};
