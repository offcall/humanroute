import { isRecord, parseTask, str, type Task } from "../shared";

export type TaskView = { task: Task; serverTime: string | undefined };

export const parseView = (raw: unknown): TaskView | undefined => {
	const task = parseTask(raw);
	if (task === undefined) {
		return undefined;
	}

	return { task, serverTime: isRecord(raw) ? str(raw.serverTime) : undefined };
};
