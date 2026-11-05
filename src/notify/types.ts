// Web Push types and the sender interface (ADR 0029). Times are Unix ms.
import type { Database } from "../store/index.js";

// A browser PushSubscription as stored: the endpoint is a capability, never logged.
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

export type SendOutcome =
	| { kind: "sent" }
	| { kind: "gone" }
	| { kind: "failed"; status: number | null; reason: string };

// Delivers one encrypted payload; never throws.
export type PushSender = (
	target: PushTarget,
	payload: string,
	ttlSeconds: number,
) => Promise<SendOutcome>;

// One new open task, as orders reports it after commit.
export type TaskNotice = {
	taskId: string;
	source: string;
	target: string;
	claimDeadline: number;
};

export type NotifyDeps = {
	database: Database;
	now: () => number;
	sessionCookie: string;
	lookupSession: (token: string | undefined) => string | null;
	// null when the VAPID config is absent: push is off.
	publicKey: string | null;
	sender: PushSender | null;
	claimWindowSeconds: number;
	log: (msg: string) => void;
};
