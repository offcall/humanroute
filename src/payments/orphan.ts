// Settled but no job: keep an orphan_payments row for the operator (ADR 0004). Refund is manual.
import type { PaymentsDeps, SettlePeek, SettleRejection } from "./types.js";

export const orphanBody = (seen: SettlePeek) => ({
	error: "orphan_payment",
	payTx: seen.transaction,
});

export const recordOrphan = (
	deps: PaymentsDeps,
	header: string,
	seen: SettlePeek,
	rejection: SettleRejection,
): void => {
	const where = `transaction=${seen.transaction ?? "?"} payer=${seen.payer ?? "?"}`;
	deps.log(
		`orphan payment ${where} reason=${rejection.reason}: ${rejection.error}`,
	);
	try {
		deps.store.orphans.insert({
			payTx: seen.transaction,
			payer: seen.payer,
			network: seen.network,
			rawHeader: header,
			reason: rejection.reason,
			now: deps.now(),
		});
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		deps.log(
			`OPERATOR ACTION REQUIRED orphan payment ${where} not stored: ${error}`,
		);
	}
};
