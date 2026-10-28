import { useCallback, useState } from "react";
import {
	arr,
	formatUsdc,
	isRecord,
	type Order,
	parseOrder,
	request,
	type Task,
	TaskState,
	usePoll,
} from "../shared";
import { TaskReview } from "./TaskReview";
import { TransferBadge } from "./TransferBadge";

const parseOrders = (raw: unknown): Order[] | undefined =>
	isRecord(raw) ? arr(raw.orders, parseOrder) : undefined;

const txUrl = (payTx: string): string =>
	`https://explorer.solana.com/tx/${payTx}?cluster=devnet`;

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

export const OrderList = () => {
	const [orders, setOrders] = useState<Order[] | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);

	const load = useCallback(async () => {
		const res = await request("GET", "/api/orders", undefined, parseOrders);
		if (!res.ok) {
			setError(res.error.message ?? res.error.error);
			return;
		}
		setError(undefined);
		setOrders(res.value);
	}, []);

	usePoll(() => void load());
	const reload = () => void load();

	return (
		<section>
			<h3>Orders</h3>
			{error === undefined ? null : <p className="error">{error}</p>}
			{orders !== undefined && orders.length === 0 ? (
				<p>No orders yet</p>
			) : null}
			{orders?.map((order) => (
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
							<TaskRow key={task.taskId} task={task} onDone={reload} />
						))}
					</ul>
				</article>
			))}
		</section>
	);
};
