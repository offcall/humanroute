// Claim (ADR 0034): the waiting tab proves its secret and consumes an approved request once.
import { timingSafeEqual } from "node:crypto";
import { readLoginRequest } from "./loginRow.js";
import { hashToken } from "./session.js";
import { LOGIN_REQUESTS_SQL } from "./sql.js";
import {
	type AuthDeps,
	type Claim,
	LoginOutcome,
	type LoginRequest,
} from "./types.js";

const secretMatches = (found: LoginRequest, secret: string): boolean =>
	timingSafeEqual(
		Buffer.from(found.secretHash),
		Buffer.from(hashToken(secret)),
	);

export const claimLoginRequest = (
	deps: AuthDeps,
	requestId: string,
	secret: string | undefined,
): Claim => {
	const now = deps.now();
	const found = readLoginRequest(deps.database, requestId);
	if (
		found === undefined ||
		secret === undefined ||
		!secretMatches(found, secret)
	) {
		return { outcome: LoginOutcome.Gone };
	}
	if (
		found.rejectedAt !== null ||
		found.consumedAt !== null ||
		found.expiresAt <= now
	) {
		return { outcome: LoginOutcome.Gone };
	}
	if (found.approvedWallet === null) {
		return { outcome: LoginOutcome.Pending };
	}

	const sql = deps.database.prepare(LOGIN_REQUESTS_SQL.consume);
	const changes = sql.run(now, requestId, now).changes;

	return changes === 1
		? { outcome: LoginOutcome.Done, wallet: found.approvedWallet }
		: { outcome: LoginOutcome.Gone };
};
