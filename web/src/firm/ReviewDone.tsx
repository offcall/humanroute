import {
	Avatar,
	Icon,
	IconName,
	navigate,
	type Order,
	pairCodes,
	StatusTag,
	statusOf,
	type Task,
	TaskState,
} from "../shared";
import { decisionLine, runningLine } from "./doneLines";
import { plural, usdcNumber } from "./format";
import "./lists.css";

const goJobs = (event: React.MouseEvent) => {
	event.preventDefault();
	navigate("/firm/jobs");
};

type Props = { decided: Task[]; orders: Order[] };

// Queue empty: your decisions here, what still runs, back to Jobs.
export const ReviewDone = ({ decided, orders }: Props) => {
	const running = orders
		.flatMap((order) => order.tasks)
		.filter(
			(task) =>
				task.state === TaskState.Open || task.state === TaskState.Claimed,
		);
	const moving = decided.filter(
		(task) => !statusOf(task.state, task.publicState).final,
	).length;

	return (
		<>
			<div className="fb-done">
				<span className="fb-done__mark" aria-hidden="true">
					<Icon name={IconName.Check} size={32} />
				</span>
				<h1 className="num-status">All reviewed</h1>
				<p className="fb-lead">
					Nothing else waits for you.
					{moving === 0
						? null
						: ` ${plural(moving, "decision")} on the way to the chain.`}
				</p>
			</div>
			{decided.length === 0 ? null : (
				<ul className="sib-list fb-decided" aria-label="Your decisions">
					{decided.map((task) => (
						<li key={task.taskId}>
							<b>{pairCodes(task.sourceLang, task.targetLang)}</b>
							<span className="who">
								<Avatar
									name={task.agency === null ? null : task.agency.name}
									small
								/>
								{decisionLine(task)}
							</span>
							<StatusTag status={statusOf(task.state, task.publicState)} />
							<b className="fb-amt">{usdcNumber(task.priceUnits)}</b>
						</li>
					))}
				</ul>
			)}
			{running.length === 0 ? null : (
				<p className="guarantee">
					Still running: {running.map(runningLine).join(", ")}. We bring them
					here when they arrive.
				</p>
			)}
			<div className="row">
				<a
					className="btn btn--primary btn--lg"
					href="/firm/jobs"
					onClick={goJobs}
				>
					Back to Jobs
				</a>
			</div>
		</>
	);
};
