import { randomBytes, randomUUID } from "node:crypto";
import { withTransaction } from "../store/index.js";
import { findAgencyByWallet, findInviteCode } from "./lookups.js";
import { AGENCIES_SQL } from "./sql.js";
import type { AccountsDeps, Agency } from "./types.js";

export const createAgency = (
	deps: AccountsDeps,
	wallet: string,
	name: string,
): Agency | null =>
	withTransaction(deps.database, () => {
		if (findAgencyByWallet(deps.database, wallet) !== null) {
			return null;
		}

		const agency: Agency = { id: randomUUID(), name, wallet };

		deps.database
			.prepare(AGENCIES_SQL.insert)
			.run(agency.id, wallet, name, deps.now());

		return agency;
	});

// One permanent invite per agency: reuse the row when it exists.
export const ensureInvite = (deps: AccountsDeps, agencyId: string): string =>
	withTransaction(deps.database, () => {
		const existing = findInviteCode(deps.database, agencyId);

		if (existing !== null) {
			return existing;
		}

		const code = randomBytes(16).toString("base64url");

		deps.database
			.prepare(AGENCIES_SQL.insertInvite)
			.run(code, agencyId, deps.now());

		return code;
	});

export const inviteUrl = (publicBaseUrl: string, code: string): string =>
	`${publicBaseUrl}/join/${code}`;
