import { type Task, useClock } from "../shared";
import { InProgress } from "./InProgress";
import { RowTime } from "./rowText";
import { TaskRow } from "./TaskRow";
import { groupTasks, isLate, isPaid } from "./taskGroups";
import "./my-tasks.css";

type Props = { tasks: Task[] };

type ListProps = {
	title: string;
	aside?: string;
	tasks: Task[];
	time: RowTime;
};

const List = ({ title, aside, tasks, time }: ListProps) =>
	tasks.length === 0 ? null : (
		<>
			<div className="list-head">
				<p className="kicker">
					{title} · {tasks.length}
				</p>
				{aside === undefined ? null : (
					<p className="list-head__aside">{aside}</p>
				)}
			</div>
			<div className="stack stack--sm">
				{tasks.map((task) => (
					<TaskRow key={task.taskId} task={task} time={time} />
				))}
			</div>
		</>
	);

// "2 paid · 1 late"
const doneAside = (tasks: Task[]): string => {
	const paid = tasks.filter(isPaid).length;
	const late = tasks.filter(isLate).length;
	const other = tasks.length - paid - late;
	const parts = [`${paid} paid`, `${late} late`, `${other} rejected`];

	return parts.filter((part) => !part.startsWith("0 ")).join(" · ");
};

// In progress · Waiting for review · Done today (stamps) · Earlier
export const MyTasks = ({ tasks }: Props) => {
	const now = useClock();
	const groups = groupTasks(tasks, now);
	const [soonest, ...otherClaimed] = groups.inProgress;

	if (tasks.length === 0) {
		return (
			<div className="empty">
				<p className="empty__title">No tasks yet.</p>
			</div>
		);
	}

	return (
		<>
			{soonest === undefined ? null : (
				<>
					<p className="kicker">In progress · {groups.inProgress.length}</p>
					<InProgress task={soonest} />
					{otherClaimed.map((task) => (
						<TaskRow key={task.taskId} task={task} time={RowTime.None} />
					))}
				</>
			)}
			<List
				title="Waiting for review"
				tasks={groups.waiting}
				time={RowTime.None}
			/>
			<List
				title="Done today"
				aside={doneAside(groups.doneToday)}
				tasks={groups.doneToday}
				time={RowTime.Clock}
			/>
			<List title="Earlier" tasks={groups.earlier} time={RowTime.Date} />
		</>
	);
};
