import { createHash, randomBytes } from "node:crypto";
import type { Database } from "../store/index.js";
import { SESSIONS_SQL } from "./sql.js";
import type { AuthDeps, SessionLookup } from "./types.js";

const hashToken = (token: string): string =>
	createHash("sha256").update(token).digest("hex");

export const createSession = (deps: AuthDeps, wallet: string): string => {
	const token = randomBytes(32).toString("base64url");
	const now = deps.now();

	// Only the sha256 of the token is stored.
	deps.database
		.prepare(SESSIONS_SQL.insert)
		.run(hashToken(token), wallet, now, now + deps.sessionTtlSeconds * 1000);

	return token;
};

export const readSession = (
	database: Database,
	now: number,
	token: string | undefined,
): string | null => {
	if (token === undefined || token === "") {
		return null;
	}

	const wallet: unknown = database
		.prepare(SESSIONS_SQL.wallet)
		.pluck()
		.get(hashToken(token), now);

	return typeof wallet === "string" ? wallet : null;
};

export const sessionLookup =
	(deps: Pick<AuthDeps, "database" | "now">): SessionLookup =>
	(token) =>
		readSession(deps.database, deps.now(), token);
