import { useRef } from "react";
import {
	Announcer,
	formatClock,
	formatLeft,
	languageName,
	type Task,
	toMs,
	URGENT_MS,
	useClock,
} from "../shared";
import { spokenLeft } from "./jobLabel";
import { LateAlert } from "./LateAlert";
import type { TaskView } from "./parseTaskView";
import { SourceFold } from "./SourceFold";
import { TaskFacts } from "./TaskFacts";
import { SubmitError, useSubmit } from "./useSubmit";

type Props = {
	task: Task;
	serverTime: string | undefined;
	text: string;
	onEdit: (text: string) => void;
	onSubmitted: (view: TaskView) => void;
};

// Claimed: time left to deliver, facts, source, the draft to edit, Submit.
export const TaskEditor = (props: Props) => {
	const { task, text } = props;
	const now = useClock(props.serverTime);
	const fieldRef = useRef<HTMLTextAreaElement>(null);
	const submitting = useSubmit(task.taskId, text, props.onSubmitted, fieldRef);
	const { busy, problem } = submitting;
	const deadline = task.workDeadline ?? task.claimDeadline;
	const leftMs = toMs(deadline) - now;
	const empty = problem?.kind === SubmitError.Empty;
	const fieldId = `result-${task.taskId}`;

	return (
		<>
			<div className="hero-time">
				<p
					className={leftMs < URGENT_MS ? "num-hero is-urgent" : "num-hero"}
					role="timer"
					aria-label={`${spokenLeft(leftMs)} left to deliver`}
				>
					{formatLeft(leftMs)}
				</p>
				<p className="hero-caption">
					left to deliver · due {formatClock(deadline)}
				</p>
			</div>
			<Announcer leftMs={leftMs} subject="to deliver" />
			<TaskFacts task={task} />
			<SourceFold task={task} />
			<div className={empty ? "field field--error" : "field"}>
				<label className="field__label" htmlFor={fieldId}>
					{languageName(task.targetLang)} · edit Claude’s draft
				</label>
				<textarea
					ref={fieldRef}
					id={fieldId}
					className="textarea"
					rows={4}
					lang={task.targetLang}
					dir="auto"
					value={text}
					onChange={(event) => props.onEdit(event.target.value)}
				/>
				{empty ? <p className="error">{problem.message}</p> : null}
			</div>
			<button
				type="button"
				className="btn btn--primary btn--block btn--lg"
				aria-busy={busy}
				aria-disabled={busy}
				onClick={busy ? undefined : () => void submitting.submit()}
			>
				Submit translation
			</button>
			{problem?.kind === SubmitError.Late ? (
				<LateAlert deadline={deadline} firmName={task.firmName} />
			) : null}
			{problem?.kind === SubmitError.Other ? (
				<p className="error">{problem.message}</p>
			) : null}
		</>
	);
};
