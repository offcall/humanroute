import { useCallback, useRef, useState } from "react";
import { Countdown, request, type Task, TaskState, usePoll } from "../shared";
import { MoneyLine } from "./MoneyLine";
import { parseView } from "./parseTaskView";

type Props = { taskId: string; onSubmitted: () => void; onClose: () => void };
export const SubmitTask = ({ taskId, onSubmitted, onClose }: Props) => {
	const [task, setTask] = useState<Task>();
	const [serverTime, setServerTime] = useState<string>();
	const [text, setText] = useState("");
	const dirtyRef = useRef(false);
	const [error, setError] = useState<string>();
	const url = `/api/tasks/${encodeURIComponent(taskId)}`;

	const load = useCallback(async () => {
		const res = await request("GET", url, undefined, parseView);
		if (!res.ok) {
			setError(res.error.message ?? res.error.error);
			return;
		}
		setTask(res.value.task);
		setServerTime(res.value.serverTime);
		if (!dirtyRef.current) {
			setText(res.value.task.result ?? res.value.task.draft);
		}
	}, [url]);

	usePoll(load);

	if (task === undefined) {
		return error === undefined ? (
			<p>Loading…</p>
		) : (
			<p className="error">{error}</p>
		);
	}

	const editable = task.state === TaskState.Claimed;
	const submit = async () => {
		if (text.trim() === "") {
			setError("Result is empty");
			return;
		}
		const res = await request(
			"POST",
			`${url}/submit`,
			{ result: text },
			parseView,
		);
		if (res.ok) {
			setTask(res.value.task);
			setServerTime(res.value.serverTime);
			dirtyRef.current = false;
			setError(undefined);
			onSubmitted();
		} else if (res.status === 409 && res.error.error === "late") {
			setError("Too late");
		} else {
			setError(res.error.message ?? res.error.error);
		}
	};

	return (
		<section>
			<h3>
				{task.sourceLang} → {task.targetLang}{" "}
				<MoneyLine state={task.publicState} priceUnits={task.priceUnits} />
			</h3>
			{editable && task.workDeadline !== null ? (
				<p>
					Time left:{" "}
					<Countdown
						deadline={task.workDeadline}
						serverTime={serverTime ?? Date.now()}
					/>
				</p>
			) : null}
			<div className="split">
				<p>{task.text}</p>
				<textarea
					value={text}
					readOnly={!editable}
					onChange={(event) => {
						setText(event.target.value);
						dirtyRef.current = true;
					}}
				/>
			</div>
			{editable ? (
				<button type="button" onClick={submit}>
					Submit
				</button>
			) : null}{" "}
			<button type="button" onClick={onClose}>
				Close
			</button>
			{error === undefined ? null : <p className="error">{error}</p>}
		</section>
	);
};
