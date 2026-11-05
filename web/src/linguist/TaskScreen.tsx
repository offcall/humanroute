import {
	Banner,
	Icon,
	IconName,
	navigate,
	pairCodes,
	pairNames,
	Spinner,
	TaskState,
} from "../shared";
import { TaskEditor } from "./TaskEditor";
import { TaskOutcome } from "./TaskOutcome";
import { TAB_PATH, Tab } from "./tabs";
import { useTaskView } from "./useTaskView";
import "./task.css";

type Props = {
	taskId: string;
	fresh: number;
	todayUnits: bigint;
	onSubmitted: () => void;
};

const back = (event: { preventDefault: () => void }) => {
	event.preventDefault();
	navigate(TAB_PATH[Tab.Tasks]);
};

// One task of the linguist: the editor while claimed, the outcome after.
export const TaskScreen = ({
	taskId,
	fresh,
	todayUnits,
	onSubmitted,
}: Props) => {
	const view = useTaskView(taskId, onSubmitted);
	const { task, error } = view;

	return (
		<>
			{fresh === 0 ? null : (
				<Banner onClick={() => navigate(TAB_PATH[Tab.Board])}>
					{fresh === 1 ? "1 new job" : `${fresh} new jobs`} on the board
				</Banner>
			)}
			<a className="back" href={TAB_PATH[Tab.Tasks]} onClick={back}>
				<span className="back__icon">
					<Icon name={IconName.Chev} size={18} />
				</span>
				My tasks
			</a>
			{error === undefined ? null : <p className="error">{error}</p>}
			{task === undefined ? (
				error === undefined ? (
					<p className="loading" role="status">
						<Spinner />
						Loading…
					</p>
				) : null
			) : (
				<>
					<div className="big-head lang-head">
						<b>{pairCodes(task.sourceLang, task.targetLang)}</b>
						<span>{pairNames(task.sourceLang, task.targetLang)}</span>
					</div>
					{task.state === TaskState.Claimed ? (
						<TaskEditor
							task={task}
							serverTime={view.serverTime}
							text={view.text}
							onEdit={view.edit}
							onSubmitted={view.submitted}
						/>
					) : (
						<TaskOutcome task={task} todayUnits={todayUnits} />
					)}
				</>
			)}
		</>
	);
};
