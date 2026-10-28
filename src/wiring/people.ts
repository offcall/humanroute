// Session and account lookups shared by the slices that need the caller's identity.
import {
	findAgencyByWallet,
	findFirmByMcpToken,
	findFirmByWallet,
	findLinguistByWallet,
	findLinguistPairs,
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
});
