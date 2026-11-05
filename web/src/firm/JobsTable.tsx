import type { Task } from "../shared";
import { JobTableRow } from "./JobTableRow";
import "./table.css";
import "./rows.css";

type Props = { tasks: Task[]; now: number };

// Big table: Status / Task / Executing / Time / USDC, your turn first (sortTasks).
export const JobsTable = ({ tasks, now }: Props) => (
	<div className="fb-table">
		<div className="jobs-table__head" aria-hidden="true">
			<span>Status</span>
			<span>Task</span>
			<span>Executing</span>
			<span>Time</span>
			<span className="cell-amt">USDC</span>
		</div>
		<ul className="jobs-table" aria-label="Tasks, your turn first">
			{tasks.map((task) => (
				<JobTableRow key={task.taskId} task={task} now={now} />
			))}
		</ul>
	</div>
);
