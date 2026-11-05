import { formatUsdc, type Order, type Task, TaskState, txUrl } from "../shared";
import { TaskReview } from "./TaskReview";
import { TransferBadge } from "./TransferBadge";

type Props = { orders: Order[]; onDone: () => void };

const TaskRow = ({ task, onDone }: { task: Task; onDone: () => void }) => (
	<li>
		<div>
			{task.sourceLang} → {task.targetLang} · {task.publicState} ·{" "}
			{formatUsdc(task.priceUnits)}
		</div>
		{task.result === null ? null : <p>{task.result}</p>}
		{task.reason === null ? null : <p>Reason: {task.reason}</p>}
		<TransferBadge transfer={task.transfer} />
		{task.state === TaskState.Submitted ? (
			<TaskReview taskId={task.taskId} onDone={onDone} />
		) : null}
	</li>
);

// Plain order list until the jobs table replaces it.
export const OrderList = ({ orders, onDone }: Props) => (
	<section>
		{orders.map((order) => (
			<article key={order.orderId}>
				<h4>
					{formatUsdc(order.totalUnits)} ·{" "}
					{new Date(order.createdAt).toLocaleString()}
				</h4>
				<a href={txUrl(order.payTx)} target="_blank" rel="noreferrer">
					Pay tx
				</a>
				<ul>
					{order.tasks.map((task) => (
						<TaskRow key={task.taskId} task={task} onDone={onDone} />
					))}
				</ul>
			</article>
		))}
	</section>
);
