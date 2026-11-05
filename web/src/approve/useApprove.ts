import { useState } from "react";
import { type ApiResult, getPhantom, request, signInSiws } from "../shared";

export enum ApproveStep {
	Idle = "idle",
	Approving = "approving",
	Rejecting = "rejecting",
	Approved = "approved",
	Rejected = "rejected",
	// 409 or 410: nothing left to do on this request.
	Closed = "closed",
}

const MESSAGES: Record<number, string> = {
	409: "This sign-in was already approved or rejected.",
	410: "This sign-in expired. Go back to Safari and tap Sign in with Phantom again.",
	401: "The signature did not check out. Tap Approve to try again.",
};

const messageOf = (res: ApiResult<true>): string => {
	if (res.ok) {
		return "";
	}
	const known = MESSAGES[res.status];
	if (known !== undefined) {
		return known;
	}

	return res.error.error === "sign_rejected"
		? "You cancelled in Phantom. Tap Approve to try again."
		: `Sign-in failed (${res.error.error}). Try again.`;
};

export const useApprove = (requestId: string) => {
	const [step, setStep] = useState(ApproveStep.Idle);
	const [error, setError] = useState<string | undefined>(undefined);
	const base = `/api/auth/login-request/${encodeURIComponent(requestId)}`;

	const finish = (res: ApiResult<true>, done: ApproveStep) => {
		if (res.ok) {
			setStep(done);
			return;
		}
		setError(messageOf(res));
		const closed = res.status === 409 || res.status === 410;
		setStep(closed ? ApproveStep.Closed : ApproveStep.Idle);
	};

	const approve = async () => {
		const phantom = getPhantom();
		if (phantom === undefined) {
			setError("Phantom is not available on this page.");
			return;
		}
		setError(undefined);
		setStep(ApproveStep.Approving);
		finish(await signInSiws(phantom, `${base}/approve`), ApproveStep.Approved);
	};

	const reject = async () => {
		setError(undefined);
		setStep(ApproveStep.Rejecting);
		const res = await request("POST", `${base}/reject`, {}, (): true => true);
		finish(res, ApproveStep.Rejected);
	};

	return { step, error, approve, reject };
};
