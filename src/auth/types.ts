import type { Database } from "../store/index.js";

export const SESSION_COOKIE = "hr_session";

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
