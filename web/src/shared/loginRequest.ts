// Sign-in via approve in Phantom (ADR 0034): the waiting tab creates a login request,
// the user approves it in Phantom, and the tab claims its session when visible again.
import { useCallback, useRef, useState } from "react";
import {
	approveLink,
	CREATED_KEY,
	claimRequest,
	createRequest,
	freshStoredId,
	olderThan,
	RENEW_AFTER_MS,
	STORAGE_KEY,
} from "./loginApi";
import { useSession } from "./session";
import { usePoll } from "./usePoll";

// opened: call on the link tap; the request is not renewed while the user may be in Phantom.
type LoginRequest = {
	link: string | undefined;
	failed: boolean;
	opened: () => void;
};

// Keeps one live request: claims it on load, on visible and every 3 s while visible;
// 200 signs the tab in, 410 or an old pending request is replaced by a fresh one.
export const useLoginRequest = (onSignedIn?: () => void): LoginRequest => {
	const { refresh } = useSession();
	const [requestId, setRequestId] = useState(freshStoredId);
	const [failed, setFailed] = useState(false);
	const busy = useRef(false);
	const done = useRef(false);
	const openedAt = useRef(0);
	const signedIn = useRef(onSignedIn);
	signedIn.current = onSignedIn;

	const renew = useCallback(async () => {
		localStorage.removeItem(STORAGE_KEY);
		localStorage.removeItem(CREATED_KEY);
		const created = await createRequest();
		setFailed(created === undefined);
		setRequestId(created ?? null);
	}, []);

	const tick = useCallback(async () => {
		const current = localStorage.getItem(STORAGE_KEY);
		if (current === null) {
			await renew();
			return;
		}
		const res = await claimRequest(current);
		if (res.ok && res.value.wallet !== undefined) {
			done.current = true;
			localStorage.removeItem(STORAGE_KEY);
			await refresh();
			signedIn.current?.();
		} else if (!res.ok && res.status === 410) {
			await renew();
		} else if (
			res.ok &&
			olderThan(RENEW_AFTER_MS) &&
			Date.now() - openedAt.current > RENEW_AFTER_MS * 2
		) {
			await renew();
		}
	}, [refresh, renew]);

	const run = useCallback(() => {
		if (busy.current || done.current) {
			return;
		}
		busy.current = true;
		void tick().finally(() => {
			busy.current = false;
		});
	}, [tick]);

	usePoll(run);

	return {
		link: requestId === null ? undefined : approveLink(requestId),
		failed,
		opened: () => {
			openedAt.current = Date.now();
		},
	};
};
