import { randomBytes, randomUUID } from "node:crypto";
import { withTransaction } from "../store/index.js";
import { findFirmByWallet } from "./lookups.js";
import { FIRMS_SQL } from "./sql.js";
import type { AccountsDeps, Firm } from "./types.js";

// Firm and its MCP token in one transaction (ADR 0021).
export const createFirm = (
	deps: AccountsDeps,
	wallet: string,
	name: string,
): { firm: Firm; token: string } | null =>
	withTransaction(deps.database, () => {
		if (findFirmByWallet(deps.database, wallet) !== null) {
			return null;
		}

		const firm: Firm = { id: randomUUID(), name, wallet };
		const token = randomBytes(32).toString("base64url");
		const now = deps.now();

		deps.database.prepare(FIRMS_SQL.insert).run(firm.id, wallet, name, now);
		deps.database.prepare(FIRMS_SQL.insertToken).run(token, firm.id, now);

		return { firm, token };
	});
