// Login request rows (ADR 0034). Every state change is one guarded UPDATE with changes === 1.
import { randomBytes } from "node:crypto";
import { readLoginRequest } from "./loginRow.js";
import { hashToken } from "./session.js";
import { LOGIN_REQUESTS_SQL } from "./sql.js";
import { type AuthDeps, LOGIN_TTL_SECONDS, LoginOutcome } from "./types.js";

export const createLoginRequest = (
	deps: AuthDeps,
): { requestId: string; secret: string; expiresAt: number } => {
	const requestId = randomBytes(16).toString("hex");
	const secret = randomBytes(32).toString("base64url");
	const now = deps.now();
	const expiresAt = now + LOGIN_TTL_SECONDS * 1000;

	deps.database
		.prepare(LOGIN_REQUESTS_SQL.insert)
		.run(requestId, hashToken(secret), now, expiresAt);

	return { requestId, secret, expiresAt };
};

// Approve or reject: no change means a settled request (409) or an expired or unknown one (410).
const settle = (
	deps: AuthDeps,
	requestId: string,
	change: (now: number) => number,
): LoginOutcome => {
	const now = deps.now();
	if (change(now) === 1) {
		return LoginOutcome.Done;
	}

	const found = readLoginRequest(deps.database, requestId);

	return found === undefined || found.expiresAt <= now
		? LoginOutcome.Gone
		: LoginOutcome.Conflict;
};

export const approveLoginRequest = (
	deps: AuthDeps,
	requestId: string,
	wallet: string,
): LoginOutcome =>
	settle(deps, requestId, (now) => {
		const sql = deps.database.prepare(LOGIN_REQUESTS_SQL.approve);
		return sql.run(wallet, now, requestId, now).changes;
	});

export const rejectLoginRequest = (
	deps: AuthDeps,
	requestId: string,
): LoginOutcome =>
	settle(deps, requestId, (now) => {
		const sql = deps.database.prepare(LOGIN_REQUESTS_SQL.reject);
		return sql.run(now, requestId, now).changes;
	});
