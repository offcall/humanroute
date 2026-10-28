// Rating outcomes: counts from tasks, money from confirmed payouts (ADR 0025).

import { moneyByAgency, moneyByFirm } from "../payouts/index.js";
import type { RatingDeps } from "../rating/index.js";
import type { Database } from "../store/index.js";
import { outcomesByAgency, outcomesByFirm } from "../tasks/index.js";

export const ratingDeps = (database: Database): RatingDeps => ({
	outcomes: {
		agencyOutcomes: (agencyId) => ({
			...outcomesByAgency(database, agencyId),
			paidUnits: moneyByAgency(database, agencyId).paidUnits,
		}),
		firmOutcomes: (firmId) => ({
			...outcomesByFirm(database, firmId),
			...moneyByFirm(database, firmId),
		}),
	},
});
