import { useEffect, useState } from "react";
import { navigate, pairCodes, type Task } from "../shared";
import { taskTitle } from "./format";
import { NotUpdated } from "./NotUpdated";
import { ReviewCard } from "./ReviewCard";
import { ReviewDone } from "./ReviewDone";
import {
	EMPTY_QUEUE,
	markDecided,
	mergeQueue,
	type Queue,
	viewQueue,
} from "./reviewQueue";
import { useOrders } from "./useOrders";
import "./review.css";

const goJobs = (event: React.MouseEvent) => {
	event.preventDefault();
	navigate("/firm/jobs");
};

// /firm/review: one submitted task at a time, from a queue that polls never reorder.
export const Review = () => {
	const { orders, serverTime, error, reload } = useOrders();
	const [queue, setQueue] = useState<Queue | undefined>(undefined);
	const [conflict, setConflict] = useState<Task | undefined>(undefined);

	useEffect(() => {
		if (orders !== undefined) {
			setQueue((prev) => mergeQueue(prev ?? EMPTY_QUEUE, orders));
		}
	}, [orders]);

	if (orders === undefined || queue === undefined) {
		return error === undefined ? (
			<p className="loading" role="status">
				Loading reviews…
			</p>
		) : (
			<NotUpdated error={error} serverTime={serverTime} />
		);
	}
	const view = viewQueue(queue, orders);
	const current = view.current;
	const onConflict = (taskId: string) => {
		setConflict(
			orders
				.flatMap((order) => order.tasks)
				.find((task) => task.taskId === taskId),
		);
	};

	return (
		<>
			<div className="meta-line">
				<span>
					<a href="/firm/jobs" onClick={goJobs}>
						‹ Jobs
					</a>{" "}
					· Review
					{current === undefined ? null : ` · ${taskTitle(current.text)}`}
				</span>
				<span>{view.waiting} waiting</span>
			</div>
			{error === undefined ? null : (
				<NotUpdated error={error} serverTime={serverTime} />
			)}
			{conflict === undefined ? null : (
				<div className="alert alert--info" role="status">
					<div>
						<b>Already decided (maybe from Claude).</b>{" "}
						{pairCodes(conflict.sourceLang, conflict.targetLang)} left the
						queue; reloading.
					</div>
				</div>
			)}
			{current === undefined ? (
				<ReviewDone decided={view.decided} orders={orders} />
			) : (
				<ReviewCard
					key={current.taskId}
					task={current}
					next={view.next}
					position={view.position}
					total={view.total}
					onDecided={(taskId) =>
						setQueue((prev) => markDecided(prev ?? EMPTY_QUEUE, taskId))
					}
					onConflict={onConflict}
					reload={reload}
				/>
			)}
		</>
	);
};
