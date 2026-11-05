import { useCallback, useRef, useState } from "react";
import { request, type Task, usePoll } from "../shared";
import { parseView, type TaskView } from "./parseTaskView";

// GET /api/tasks/:id, polled; a poll never overwrites the linguist's edits.
export const useTaskView = (taskId: string, onSubmitted: () => void) => {
	const [task, setTask] = useState<Task>();
	const [serverTime, setServerTime] = useState<string>();
	const [text, setText] = useState("");
	const dirtyRef = useRef(false);
	const [error, setError] = useState<string>();
	const url = `/api/tasks/${encodeURIComponent(taskId)}`;

	const show = useCallback((view: TaskView) => {
		setTask(view.task);
		setServerTime(view.serverTime);
		if (!dirtyRef.current) {
			setText(view.task.result ?? view.task.draft);
		}
	}, []);

	const load = useCallback(async () => {
		const res = await request("GET", url, undefined, parseView);
		if (res.ok) {
			setError(undefined);
			show(res.value);
		} else {
			setError(res.error.message ?? res.error.error);
		}
	}, [url, show]);

	usePoll(load);

	const submitted = (view: TaskView) => {
		dirtyRef.current = false;
		show(view);
		onSubmitted();
	};
	const edit = (next: string) => {
		dirtyRef.current = true;
		setText(next);
	};

	return { task, serverTime, text, error, edit, submitted };
};
