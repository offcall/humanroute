import type { Database } from "../store/index.js";

// Must match the auth slice cookie (ADR 0020); accounts may not import auth.
export const SESSION_COOKIE = "hr_session";

// Returns the session wallet, or null when the token is missing, unknown or expired.
export type SessionLookup = (token: string | undefined) => string | null;

export type AccountsDeps = {
	database: Database;
	now: () => number;
	lookupSession: SessionLookup;
	publicBaseUrl: string;
	mcpPublicUrl: string;
};

export type Firm = { id: string; name: string; wallet: string };
export type Agency = { id: string; name: string; wallet: string };

// Linguist plus its agency wallet: the payee snapshot taken at claim (ADR 0019).
export type LinguistLink = {
	linguistId: string;
	linguistWallet: string;
	agencyId: string;
	agencyWallet: string;
};

export type LangPair = { source: string; target: string };

export type JoinResult =
	| { kind: "joined"; link: LinguistLink; agency: Agency }
	| { kind: "not_found" }
	| { kind: "other_agency" };
