import {
	type Database,
	int,
	optInt,
	optText,
	row,
	text,
} from "../store/index.js";
import { LOGIN_REQUESTS_SQL } from "./sql.js";
import type { LoginRequest } from "./types.js";

export const readLoginRequest = (
	database: Database,
	requestId: string,
): LoginRequest | undefined => {
	const found = row(database.prepare(LOGIN_REQUESTS_SQL.byId).get(requestId));
	if (found === undefined) {
		return undefined;
	}

	return {
		secretHash: text(found, "secret_hash"),
		expiresAt: int(found, "expires_at"),
		approvedWallet: optText(found, "approved_wallet"),
		approvedAt: optInt(found, "approved_at"),
		rejectedAt: optInt(found, "rejected_at"),
		consumedAt: optInt(found, "consumed_at"),
	};
};
