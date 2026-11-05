import { useState } from "react";
import { type ApiResult, parseTask, request, type Task } from "../shared";

export enum Action {
	Approve = "approve",
	Reject = "reject",
}

// required: reject without a reason (client check or 422 reason_required)
export type DecisionError =
	| { kind: "required" }
	| { kind: "failed"; action: Action; code: string };

// onConflict: 409 bad_state, the task was decided elsewhere (maybe from Claude).
type Props = {
	taskId: string;
	onDecided: (taskId: string) => void;
	onConflict: (taskId: string) => void;
	reload: () => void;
};

export const useDecision = ({
	taskId,
	onDecided,
	onConflict,
	reload,
}: Props) => {
	const [busy, setBusy] = useState<Action | undefined>(undefined);
	const [error, setError] = useState<DecisionError | undefined>(undefined);

	const finish = (action: Action, res: ApiResult<Task>) => {
		setBusy(undefined);
		if (res.ok) {
			setError(undefined);
			onDecided(taskId);
		} else if (res.status === 409 && res.error.error === "bad_state") {
			onConflict(taskId);
		} else if (res.status === 422 && res.error.error === "reason_required") {
			setError({ kind: "required" });
			return;
		} else {
			setError({ kind: "failed", action, code: res.error.error });
			return;
		}
		reload();
	};

	const send = async (action: Action, body: unknown) => {
		if (busy !== undefined) {
			return;
		}
		setBusy(action);
		const path = `/api/tasks/${encodeURIComponent(taskId)}/${action}`;
		finish(action, await request("POST", path, body, parseTask));
	};

	return {
		busy,
		error,
		setError,
		approve: () => void send(Action.Approve, undefined),
		reject: (reason: string) => void send(Action.Reject, { reason }),
	};
};
