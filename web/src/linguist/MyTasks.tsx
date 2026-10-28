import { useState } from "react";
import type { Task } from "../shared";
import { MoneyLine } from "./MoneyLine";
import { SubmitTask } from "./SubmitTask";

type Props = { tasks: Task[]; onChanged: () => void };

export const MyTasks = ({ tasks, onChanged }: Props) => {
	const [openId, setOpenId] = useState<string>();

	return (
		<section>
			<h2>My tasks</h2>
			{tasks.length === 0 ? <p>No tasks yet.</p> : null}
			<ul>
				{tasks.map((task) => (
					<li key={task.taskId}>
						<button type="button" onClick={() => setOpenId(task.taskId)}>
							{task.sourceLang} → {task.targetLang}
						</button>{" "}
						<MoneyLine state={task.publicState} priceUnits={task.priceUnits} />
					</li>
				))}
			</ul>
			{openId === undefined ? null : (
				<SubmitTask
					key={openId}
					taskId={openId}
					onSubmitted={onChanged}
					onClose={() => setOpenId(undefined)}
				/>
			)}
		</section>
	);
};
