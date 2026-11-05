import { navigate, type Task } from "../shared";
import { MoneyLine } from "./MoneyLine";

type Props = { tasks: Task[] };

export const MyTasks = ({ tasks }: Props) => (
	<section>
		{tasks.length === 0 ? <p>No tasks yet.</p> : null}
		<ul>
			{tasks.map((task) => (
				<li key={task.taskId}>
					<button
						type="button"
						onClick={() =>
							navigate(`/linguist/tasks/${encodeURIComponent(task.taskId)}`)
						}
					>
						{task.sourceLang} → {task.targetLang}
					</button>{" "}
					<MoneyLine state={task.publicState} priceUnits={task.priceUnits} />
				</li>
			))}
		</ul>
	</section>
);
