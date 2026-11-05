// Session and account lookups shared by the slices that need the caller's identity.
import {
	findAgencyById,
	findAgencyByWallet,
	findFirmById,
	findFirmByMcpToken,
	findFirmByWallet,
	findLinguistByWallet,
	findLinguistPairs,
	findTranslatorNo,
} from "../accounts/index.js";
import { sessionLookup } from "../auth/index.js";
import type { Database } from "../store/index.js";

export const peopleDeps = (database: Database, now: () => number) => ({
	lookupSession: sessionLookup({ database, now }),
	firmByWallet: (wallet: string) => findFirmByWallet(database, wallet),
	firmByMcpToken: (token: string) => findFirmByMcpToken(database, token),
	agencyByWallet: (wallet: string) => findAgencyByWallet(database, wallet),
	linguistByWallet: (wallet: string) => findLinguistByWallet(database, wallet),
	linguistPairs: (linguistId: string) =>
		findLinguistPairs(database, linguistId),
	firmById: (firmId: string) => findFirmById(database, firmId),
	agencyById: (agencyId: string) => findAgencyById(database, agencyId),
	translatorNo: (linguistId: string) => findTranslatorNo(database, linguistId),
});
