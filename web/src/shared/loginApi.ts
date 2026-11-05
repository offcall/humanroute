// Login request calls and local storage (ADR 0034).
import { request } from "./api";
import { isRecord, str } from "./parse";
import { phantomDeepLink } from "./wallet";

export const STORAGE_KEY = "hr_login_request";
export const CREATED_KEY = "hr_login_request_at";
// The server TTL is 120 s; a pending request is replaced after 60 s so a tap never opens a dying one.
export const RENEW_AFTER_MS = 60_000;
const LOGIN_PATH = "/api/auth/login-request";

const parseCreated = (raw: unknown): string | undefined =>
	isRecord(raw) ? str(raw.id) : undefined;

export const createRequest = async (): Promise<string | undefined> => {
	const res = await request("POST", LOGIN_PATH, {}, parseCreated);
	if (!res.ok) {
		return undefined;
	}
	localStorage.setItem(STORAGE_KEY, res.value);
	localStorage.setItem(CREATED_KEY, String(Date.now()));

	return res.value;
};

// No stored time (an id from an older build) counts as old.
export const olderThan = (ms: number): boolean =>
	Date.now() - Number(localStorage.getItem(CREATED_KEY)) > ms;

// The stored id is shown at once only while young; an older one waits for the first claim,
// which signs in (approved), renews (pending) or drops it (410).
export const freshStoredId = (): string | null =>
	olderThan(RENEW_AFTER_MS) ? null : localStorage.getItem(STORAGE_KEY);

// 200 carries the wallet; 202 pending has none.
const parseClaim = (
	raw: unknown,
): { wallet: string | undefined } | undefined =>
	isRecord(raw) ? { wallet: str(raw.wallet) } : undefined;

export const claimRequest = (requestId: string) =>
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
