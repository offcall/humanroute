// Task steps of the flow: claim and submit (linguist), approve and reject (firm), wait for payouts.
import { arrayField, type Body, call, type Jar, stringField } from "./http.js";

const POLL_MS = 3000;
const TIMEOUT_MS = 8 * 60 * 1000;

export type TaskState = {
	taskId: string;
	targetLang: string;
	publicState: string;
	transferStatus: string | null;
	transferTx: string | null;
	memo: string | null;
};

const nullableString = (body: Body, key: string): string | null => {
	const value = body[key];
	return typeof value === "string" ? value : null;
};

const toState = (task: Body): TaskState => {
	const transfer = task.transfer;
	const view =
		typeof transfer === "object" && transfer !== null
			? Object.fromEntries(Object.entries(transfer))
			: {};
	return {
		taskId: stringField(task, "taskId"),
		targetLang: stringField(task, "targetLang"),
		publicState: stringField(task, "publicState"),
		transferStatus: nullableString(view, "status"),
		transferTx: nullableString(view, "payTx"),
		memo: nullableString(view, "memo"),
	};
};

export const readTasks = async (
	gateway: string,
	firm: Jar,
	orderId: string,
): Promise<TaskState[]> => {
	const list = await call(gateway, "GET", "/api/orders", "orders", {
		jar: firm,
	});
	for (const order of arrayField(list, "orders")) {
		if (stringField(order, "orderId") === orderId) {
			return arrayField(order, "tasks").map(toState);
		}
	}
	throw new Error(`order ${orderId} not found in GET /api/orders`);
};

export const workTask = async (
	gateway: string,
	linguist: Jar,
	taskId: string,
): Promise<void> => {
	const base = `/api/tasks/${taskId}`;
	await call(gateway, "POST", `${base}/claim`, "claim", { jar: linguist });
	await call(gateway, "POST", `${base}/submit`, "submit", {
		jar: linguist,
		body: { result: "Translated by the e2e linguist." },
	});
	console.log(`task ${taskId} claimed and submitted`);
};

export const decideTask = async (
	gateway: string,
	firm: Jar,
	taskId: string,
	approve: boolean,
): Promise<void> => {
	const base = `/api/tasks/${taskId}`;
	if (approve) {
		await call(gateway, "POST", `${base}/approve`, "approve", { jar: firm });
		return;
	}
	await call(gateway, "POST", `${base}/reject`, "reject", {
		jar: firm,
		body: { reason: "e2e: translation rejected on purpose" },
	});
};

const isFinal = (task: TaskState): boolean =>
	task.transferStatus === "confirmed" &&
	(task.publicState === "paid_out" || task.publicState === "refunded");

export const waitFinal = async (
	gateway: string,
	firm: Jar,
	orderId: string,
): Promise<TaskState[]> => {
	const deadline = Date.now() + TIMEOUT_MS;
	let last = "";
	while (Date.now() < deadline) {
		const tasks = await readTasks(gateway, firm, orderId);
		const line = tasks
			.map((task) => `${task.targetLang}:${task.publicState}`)
			.join(" ");
		if (line !== last) {
			console.log(`states ${line}`);
			last = line;
		}
		if (tasks.every(isFinal)) {
			return tasks;
		}
		await new Promise((resolve) => setTimeout(resolve, POLL_MS));
	}
	throw new Error("tasks did not reach final confirmed states within 8 min");
};
