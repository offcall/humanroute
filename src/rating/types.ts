// Outcome counts come from tasks (ADR 0025); injected until tasks exports them.
export type AgencyOutcomes = {
	approved: number;
	rejected: number;
	late: number;
	paidUnits: bigint;
};

export type FirmOutcomes = {
	approved: number;
	rejected: number;
	spentUnits: bigint;
	refundedUnits: bigint;
};

// Unknown ids return zero counts and zero amounts, never an error.
export type OutcomeSource = {
	agencyOutcomes: (agencyId: string) => AgencyOutcomes;
	firmOutcomes: (firmId: string) => FirmOutcomes;
};

export type RatingDeps = { outcomes: OutcomeSource };
