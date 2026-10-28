import { randomUUID } from "node:crypto";
import { withTransaction } from "../store/index.js";
import { findLinguistByWallet, findLinguistPairs } from "./lookups.js";
import { toAgency } from "./rows.js";
import { AGENCIES_SQL, LINGUISTS_SQL } from "./sql.js";
import type { AccountsDeps, JoinResult, LangPair } from "./types.js";

export const joinAgency = (
	deps: AccountsDeps,
	wallet: string,
	inviteCode: string,
): JoinResult =>
	withTransaction(deps.database, (): JoinResult => {
		const agency = toAgency(
			deps.database.prepare(AGENCIES_SQL.byInvite).get(inviteCode),
		);

		if (agency === null) {
			return { kind: "not_found" };
		}

		const existing = findLinguistByWallet(deps.database, wallet);

		if (existing !== null) {
			return existing.agencyId === agency.id
				? { kind: "joined", link: existing, agency }
				: { kind: "other_agency" };
		}

		const id = randomUUID();

		deps.database
			.prepare(LINGUISTS_SQL.insert)
			.run(id, wallet, agency.id, deps.now());

		return {
			kind: "joined",
			link: {
				linguistId: id,
				linguistWallet: wallet,
				agencyId: agency.id,
				agencyWallet: agency.wallet,
			},
			agency,
		};
	});

export const replacePairs = (
	deps: AccountsDeps,
	linguistId: string,
	pairs: LangPair[],
): LangPair[] =>
	withTransaction(deps.database, () => {
		deps.database.prepare(LINGUISTS_SQL.deletePairs).run(linguistId);

		const insertPair = deps.database.prepare(LINGUISTS_SQL.insertPair);

		for (const pair of pairs) {
			insertPair.run(linguistId, pair.source, pair.target);
		}

		return findLinguistPairs(deps.database, linguistId);
	});
