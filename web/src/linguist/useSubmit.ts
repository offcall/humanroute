import { type RefObject, useState } from "react";
import { request } from "../shared";
import { parseView, type TaskView } from "./parseTaskView";

export enum SubmitError {
	Empty = "empty",
	Late = "late",
	Other = "other",
}

export type SubmitProblem = { kind: SubmitError; message: string };

// POST /api/tasks/:id/submit; an empty result never leaves the page.
export const useSubmit = (
	taskId: string,
	text: string,
	onDone: (view: TaskView) => void,
	fieldRef: RefObject<HTMLTextAreaElement | null>,
) => {
	const [busy, setBusy] = useState(false);
	const [problem, setProblem] = useState<SubmitProblem>();

	const submit = async () => {
		if (text.trim() === "") {
			setProblem({ kind: SubmitError.Empty, message: "Result is empty" });
			fieldRef.current?.focus();
			return;
		}
		setBusy(true);
		const url = `/api/tasks/${encodeURIComponent(taskId)}/submit`;
		const res = await request("POST", url, { result: text }, parseView);
		setBusy(false);
		if (res.ok) {
			setProblem(undefined);
			onDone(res.value);
		} else if (res.status === 409 && res.error.error === "late") {
			setProblem({ kind: SubmitError.Late, message: "Too late" });
		} else {
			const message = res.error.message ?? res.error.error;
			setProblem({ kind: SubmitError.Other, message });
		}
	};

	return { busy, problem, submit };
};
