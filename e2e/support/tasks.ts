// Task steps through the cabinet routes: claim and submit (linguist), approve and reject (firm),
// and a bounded wait until a task's transfer is confirmed.
import { gatewayUrl, pollUntil } from "./env.js";
import { type Body, call, isRecord, type Jar, list, text } from "./http.js";

export type TaskState = {
	taskId: string;
	targetLang: string;
	state: string;
	publicState: string;
	claimDeadline: string;
	reason: string | null;
	transferStatus: string | null;
	transferTx: string | null;
	memo: string | null;
};

const maybeText = (body: Body, key: string): string | null => {
	const value = body[key];
	return typeof value === "string" ? value : null;
};

export const toTaskState = (task: Body): TaskState => {
	const transfer = isRecord(task.transfer) ? task.transfer : {};
	return {
		taskId: text(task, "taskId"),
		targetLang: text(task, "targetLang"),
		state: text(task, "state"),
		publicState: text(task, "publicState"),
		claimDeadline: text(task, "claimDeadline"),
		reason: maybeText(task, "reason"),
		transferStatus: maybeText(transfer, "status"),
		transferTx: maybeText(transfer, "payTx"),
		memo: maybeText(transfer, "memo"),
	};
};

export const orderTasks = async (
	firm: Jar,
	orderId: string,
): Promise<TaskState[]> => {
	const order = await call(gatewayUrl(), "GET", `/api/orders/${orderId}`, {
		jar: firm,
	});
	return list(order, "tasks").map(toTaskState);
};

export const taskOf = (tasks: TaskState[], lang: string): TaskState => {
	const found = tasks.find((task) => task.targetLang === lang);
	if (!found) {
		throw new Error(`no ${lang} task in ${JSON.stringify(tasks)}`);
	}
	return found;
};

const post = (jar: Jar, path: string, body: unknown, status?: number) =>
	call(gatewayUrl(), "POST", path, {
		jar,
		body,
		...(status === undefined ? {} : { status }),
	});

export const claim = (linguist: Jar, taskId: string) =>
	post(linguist, `/api/tasks/${taskId}/claim`, {});

export const submit = (
	linguist: Jar,
	taskId: string,
	status?: number,
	result = "Translated by the e2e linguist.",
) => post(linguist, `/api/tasks/${taskId}/submit`, { result }, status);

export const approve = (firm: Jar, taskId: string) =>
	post(firm, `/api/tasks/${taskId}/approve`, {});

export const reject = (firm: Jar, taskId: string, reason: string) =>
	post(firm, `/api/tasks/${taskId}/reject`, { reason });

const FINAL = ["paid_out", "refunded"];

export const waitConfirmed = async (
	firm: Jar,
	orderId: string,
	taskId: string,
	timeoutMs = 90_000,
): Promise<TaskState> => {
	const read = async () => {
		const tasks = await orderTasks(firm, orderId);
		return tasks.find((task) => task.taskId === taskId);
	};
	const found = await pollUntil(
		read,
		(task) =>
			task !== undefined &&
			task.transferStatus === "confirmed" &&
			FINAL.includes(task.publicState),
		timeoutMs,
		`task ${taskId} confirmed`,
	);
	if (found === undefined) {
		throw new Error(`task ${taskId} vanished`);
	}
	return found;
};
