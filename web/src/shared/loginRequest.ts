// Sign-in via approve in Phantom (ADR 0034): the waiting tab creates a login request,
// the user approves it in Phantom, and the tab claims its session when visible again.
import { useCallback, useRef, useState } from "react";
import { request } from "./api";
import { isRecord, str } from "./parse";
import { useSession } from "./session";
import { usePoll } from "./usePoll";
import { phantomDeepLink } from "./wallet";

const STORAGE_KEY = "hr_login_request";
const LOGIN_PATH = "/api/auth/login-request";

const parseCreated = (raw: unknown): string | undefined =>
	isRecord(raw) ? str(raw.id) : undefined;

const createRequest = async (): Promise<string | undefined> => {
	const res = await request("POST", LOGIN_PATH, {}, parseCreated);
	if (!res.ok) {
		return undefined;
	}
	localStorage.setItem(STORAGE_KEY, res.value);

	return res.value;
};

// 200 carries the wallet; 202 pending has none.
const parseClaim = (
	raw: unknown,
): { wallet: string | undefined } | undefined =>
	isRecord(raw) ? { wallet: str(raw.wallet) } : undefined;

const claimRequest = (requestId: string) =>
	request(
		"POST",
		`${LOGIN_PATH}/${encodeURIComponent(requestId)}/claim`,
		{},
		parseClaim,
	);

export const approveLink = (requestId: string): string =>
	phantomDeepLink(
		`${window.location.origin}/approve/${encodeURIComponent(requestId)}`,
	);

type LoginRequest = { link: string | undefined; failed: boolean };

// Keeps one live request: claims it on load, on visible and every 3 s while visible;
// 200 signs the tab in, 410 drops the request and opens a fresh one.
export const useLoginRequest = (onSignedIn?: () => void): LoginRequest => {
	const { refresh } = useSession();
	const [requestId, setRequestId] = useState(() =>
		localStorage.getItem(STORAGE_KEY),
	);
	const [failed, setFailed] = useState(false);
	const busy = useRef(false);
	const done = useRef(false);
	const signedIn = useRef(onSignedIn);
	signedIn.current = onSignedIn;

	const renew = useCallback(async () => {
		localStorage.removeItem(STORAGE_KEY);
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
	};
};
