import { useState } from "react";
import { type ApiResult, parseTask, request, type Task } from "../shared";

type Props = { taskId: string; onDone: () => void };

export const TaskReview = ({ taskId, onDone }: Props) => {
	const [reason, setReason] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);

	const finish = (res: ApiResult<Task>) => {
		setBusy(false);
		if (!res.ok) {
			setError(res.error.message ?? res.error.error);
			return;
		}
		setError(undefined);
		onDone();
	};

	const approve = async () => {
		setBusy(true);
		const path = `/api/tasks/${encodeURIComponent(taskId)}/approve`;
		finish(await request("POST", path, undefined, parseTask));
	};

	const reject = async () => {
		setBusy(true);
		const path = `/api/tasks/${encodeURIComponent(taskId)}/reject`;
		finish(await request("POST", path, { reason: reason.trim() }, parseTask));
	};

	return (
		<div>
			<button type="button" disabled={busy} onClick={approve}>
				Approve
			</button>
			<textarea
				value={reason}
				onChange={(event) => setReason(event.target.value)}
				placeholder="Reject reason"
				maxLength={1000}
				style={{ display: "block", width: "100%", margin: "8px 0" }}
			/>
			<button
				type="button"
				disabled={busy || reason.trim() === ""}
				onClick={reject}
			>
				Reject
			</button>
			{error === undefined ? null : <p className="error">{error}</p>}
		</div>
	);
};
