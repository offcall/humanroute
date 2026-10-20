export type PayoutTerms = {
	expertWallet: string;
	releaseUnits: bigint;
	refundUnits: bigint;
};

export type AnswerResult =
	| { ok: true }
	| { ok: false; status: 400 | 404 | 409; error: string };
