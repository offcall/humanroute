import {
	navigate,
	type Order,
	pairCodes,
	SegBar,
	statusOf,
	type Task,
	useClock,
} from "../shared";
import { Executing } from "./Executing";
import { taskTitle } from "./format";
import { NotUpdated } from "./NotUpdated";
import { Siblings } from "./Siblings";
import { StatusStamp } from "./StatusStamp";
import { TaskGuarantee } from "./TaskGuarantee";
import { TaskMoney } from "./TaskMoney";
import { TaskTexts } from "./TaskTexts";
import { TransferError } from "./TransferError";
import { useOrder } from "./useOrder";
import "./detail.css";

const goJobs = (event: React.MouseEvent) => {
	event.preventDefault();
	navigate("/firm/jobs");
};

type BodyProps = { task: Task; order: Order; serverTime: string | undefined };

// One task; every part follows the order poll (paying out, paid out, refunded) without a reload.
const DetailBody = ({ task, order, serverTime }: BodyProps) => {
	const now = useClock(serverTime);
	const status = statusOf(task.state, task.publicState);

	return (
		<>
			<div className="fb-status-row">
				<h1 className="num-status">{status.word}</h1>
				<StatusStamp task={task} />
			</div>
			<SegBar status={status} labelled />
			<Executing task={task} />
			<TaskMoney task={task} order={order} />
			<TaskGuarantee task={task} now={now} />
			<TransferError task={task} />
			<TaskTexts task={task} />
			<Siblings
				tasks={order.tasks.filter((other) => other.taskId !== task.taskId)}
			/>
		</>
	);
};

type Props = { orderId: string; lang: string };

// /firm/jobs/:orderId/:lang
export const TaskDetail = ({ orderId, lang }: Props) => {
	const { order, serverTime, error } = useOrder(orderId);
	const task = order?.tasks.find((item) => item.targetLang === lang);
	const first = order?.tasks[0];

	return (
		<>
			<div className="meta-line">
				<span>
					<a href="/firm/jobs" onClick={goJobs}>
						‹ Jobs
					</a>{" "}
					· <b className="mono">{orderId}</b>
					{first === undefined ? null : ` · ${taskTitle(first.text)}`}
				</span>
				{task === undefined ? null : (
					<span>{pairCodes(task.sourceLang, task.targetLang)}</span>
				)}
			</div>
			{error === undefined ? null : (
				<NotUpdated error={error} serverTime={serverTime} />
			)}
			{order === undefined && error === undefined ? (
				<p className="loading" role="status">
					Loading the task…
				</p>
			) : null}
			{order !== undefined && task === undefined ? (
				<p className="error">No {lang} task in this order.</p>
			) : null}
			{order === undefined || task === undefined ? null : (
				<DetailBody task={task} order={order} serverTime={serverTime} />
			)}
		</>
	);
};
