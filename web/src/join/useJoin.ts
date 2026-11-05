import { useState } from "react";
import { isRecord, navigate, request, useSession } from "../shared";

export enum JoinBusy {
	Idle = "idle",
	SignIn = "sign-in",
	Join = "join",
}

export enum JoinFailure {
	SignIn = "sign-in",
	NotFound = "not-found",
	OtherAgency = "other-agency",
	Other = "other",
}

export type JoinError = { kind: JoinFailure; code: string };

const parseJoined = (raw: unknown): true | undefined =>
	isRecord(raw) ? true : undefined;

const failureOf = (status: number): JoinFailure => {
	if (status === 404) {
		return JoinFailure.NotFound;
	}

	return status === 409 ? JoinFailure.OtherAgency : JoinFailure.Other;
};

export const useJoin = (inviteCode: string) => {
	const { me, signIn, refresh } = useSession();
	const [busy, setBusy] = useState(JoinBusy.Idle);
	const [error, setError] = useState<JoinError | undefined>(undefined);

	const join = async () => {
		setError(undefined);
		if (me === null) {
			setBusy(JoinBusy.SignIn);
			const failed = await signIn();
			if (failed !== undefined) {
				setError({ kind: JoinFailure.SignIn, code: failed });
				setBusy(JoinBusy.Idle);
				return;
			}
		}

		setBusy(JoinBusy.Join);
		const url = `/api/linguist/join/${encodeURIComponent(inviteCode)}`;
		const res = await request("POST", url, {}, parseJoined);
		if (res.ok) {
			await refresh();
			navigate("/linguist");
			return;
		}
		const code = res.error.message ?? res.error.error;
		setError({ kind: failureOf(res.status), code });
		setBusy(JoinBusy.Idle);
	};

	return { busy, error, join };
};
