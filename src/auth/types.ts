import type { Database } from "../store/index.js";

export const SESSION_COOKIE = "hr_session";
export const LOGIN_COOKIE = "hr_login";
export const LOGIN_PATH = "/api/auth/login-request";

// ADR 0034: a login request lives 2 minutes.
export const LOGIN_TTL_SECONDS = 120;

export type AuthDeps = {
	database: Database;
	now: () => number;
	publicBaseUrl: string;
	sessionTtlSeconds: number;
	nonceTtlSeconds: number;
};

// Returns the session wallet, or null when the token is missing, unknown or expired.
export type SessionLookup = (token: string | undefined) => string | null;

export type VerifyBody = {
	wallet: string;
	publicKey: Uint8Array;
	nonce: string;
	signature: Uint8Array;
};

export type LoginRequest = {
	secretHash: string;
	expiresAt: number;
	approvedWallet: string | null;
	approvedAt: number | null;
	rejectedAt: number | null;
	consumedAt: number | null;
};

export enum LoginOutcome {
	Done = "done",
	Pending = "pending",
	Conflict = "conflict",
	Gone = "gone",
}

export type Claim =
	| { outcome: LoginOutcome.Done; wallet: string }
	| { outcome: LoginOutcome.Pending | LoginOutcome.Gone };
