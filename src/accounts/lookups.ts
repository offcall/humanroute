// Read-only lookups exported to other slices (orders, tasks, mcp, http).
import type { Database } from "../store/index.js";
import { toAgency, toFirm, toLink, toPairs } from "./rows.js";
import { AGENCIES_SQL, FIRMS_SQL, LINGUISTS_SQL } from "./sql.js";
import type { Agency, Firm, LangPair, LinguistLink } from "./types.js";

export const findFirmByWallet = (
	database: Database,
	wallet: string,
): Firm | null => toFirm(database.prepare(FIRMS_SQL.byWallet).get(wallet));

export const findFirmById = (database: Database, id: string): Firm | null =>
	toFirm(database.prepare(FIRMS_SQL.byId).get(id));

export const findFirmByMcpToken = (
	database: Database,
	token: string,
): Firm | null => toFirm(database.prepare(FIRMS_SQL.byToken).get(token));

export const findAgencyByWallet = (
	database: Database,
	wallet: string,
): Agency | null =>
	toAgency(database.prepare(AGENCIES_SQL.byWallet).get(wallet));

export const findAgencyById = (database: Database, id: string): Agency | null =>
	toAgency(database.prepare(AGENCIES_SQL.byId).get(id));

export const findAgencyByInvite = (
	database: Database,
	inviteCode: string,
): Agency | null =>
	toAgency(database.prepare(AGENCIES_SQL.byInvite).get(inviteCode));

export const findLinguistByWallet = (
	database: Database,
	wallet: string,
): LinguistLink | null =>
	toLink(database.prepare(LINGUISTS_SQL.byWallet).get(wallet));

export const findLinguistPairs = (
	database: Database,
	linguistId: string,
): LangPair[] => toPairs(database.prepare(LINGUISTS_SQL.pairs).all(linguistId));

// Linguists who work in the pair: the push recipients of a new task (ADR 0029).
export const findLinguistIdsByPair = (
	database: Database,
	pair: LangPair,
): string[] =>
	database
		.prepare(LINGUISTS_SQL.byPair)
		.pluck()
		.all(pair.source, pair.target)
		.filter((value) => typeof value === "string");

export const findMcpToken = (
	database: Database,
	firmId: string,
): string | null => {
	const value: unknown = database.prepare(FIRMS_SQL.token).pluck().get(firmId);

	return typeof value === "string" ? value : null;
};

export const findInviteCode = (
	database: Database,
	agencyId: string,
): string | null => {
	const value: unknown = database
		.prepare(AGENCIES_SQL.inviteCode)
		.pluck()
		.get(agencyId);

	return typeof value === "string" ? value : null;
};

// "Translator #N" inside the linguist's agency (ADR 0033), or null for an unknown linguist.
export const findTranslatorNo = (
	database: Database,
	linguistId: string,
): number | null => {
	const value: unknown = database
		.prepare(LINGUISTS_SQL.rank)
		.pluck()
		.get(linguistId);

	return typeof value === "number" && value > 0 ? value : null;
};
