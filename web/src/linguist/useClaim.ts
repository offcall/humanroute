import { useState } from "react";
import { parseTask, request } from "../shared";

export type ClaimError = { taskId: string; message: string };

// POST /api/tasks/:id/claim; a 409 (taken or closed) also marks the row lost.
export const useClaim = (
	onClaimed: (taskId: string) => void,
	onLost: (taskId: string) => void,
) => {
	const [busy, setBusy] = useState(false);
	const [claimError, setClaimError] = useState<ClaimError>();

	const claim = async (taskId: string) => {
		setBusy(true);
		const url = `/api/tasks/${encodeURIComponent(taskId)}/claim`;
		const res = await request("POST", url, {}, parseTask);
		setBusy(false);
		if (res.ok) {
			setClaimError(undefined);
			onClaimed(taskId);
			return;
		}
		if (res.status === 409) {
			onLost(taskId);
		}
		setClaimError({ taskId, message: res.error.message ?? res.error.error });
	};

	return { busy, claimError, claim };
};
