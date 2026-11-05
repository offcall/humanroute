import {
	Avatar,
	navigate,
	pairCodes,
	StatusTag,
	statusOf,
	type Task,
	TaskState,
	TxLink,
} from "../shared";
import "./lists.css";

const go = (href: string) => (event: React.MouseEvent) => {
	event.preventDefault();
	navigate(href);
};

const who = (task: Task): string => {
	if (task.agency === null) {
		return "No translator yet";
	}

	return task.translatorNo === null
		? task.agency.name
		: `${task.agency.name} · #${task.translatorNo}`;
};

// Review for a submitted task, else its transfer tx once there is one.
const Action = ({ task }: { task: Task }) => {
	if (task.state === TaskState.Submitted) {
		return (
			<a
				className="btn btn--primary btn--xs"
				href="/firm/review"
				onClick={go("/firm/review")}
			>
				Review
				<span className="visually-hidden">
					{" "}
					{pairCodes(task.sourceLang, task.targetLang)}
				</span>
			</a>
		);
	}
	const payTx = task.transfer === null ? null : task.transfer.payTx;

	return payTx === null ? <span /> : <TxLink signature={payTx} />;
};

// Other tasks of the same order; the pair opens that task.
export const Siblings = ({ tasks }: { tasks: Task[] }) => {
	if (tasks.length === 0) {
		return null;
	}

	return (
		<div>
			<p className="kicker fb-sib-title">Other tasks in this order</p>
			<ul className="sib-list">
				{tasks.map((task) => {
					const href = `/firm/jobs/${encodeURIComponent(task.orderId)}/${encodeURIComponent(task.targetLang)}`;

					return (
						<li key={task.taskId}>
							<b>
								<a href={href} onClick={go(href)}>
									{pairCodes(task.sourceLang, task.targetLang)}
								</a>
							</b>
							<StatusTag status={statusOf(task.state, task.publicState)} />
							<span className="who">
								<Avatar
									name={task.agency === null ? null : task.agency.name}
									small
								/>
								{who(task)}
							</span>
							<Action task={task} />
						</li>
					);
				})}
			</ul>
		</div>
	);
};
