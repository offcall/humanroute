// Settled but no order: keep an orphans row for the operator (ADR 0016). Refund is manual.
import { optText, row } from "../store/index.js";
import { ORDERS_SQL } from "./sql.js";
import type { OrdersDeps, SettlePeek, SettleRejection } from "./types.js";

export const orphanBody = (seen: SettlePeek) => ({
	error: "orphan_payment",
	payTx: seen.transaction,
});

export const recordOrphan = (
	deps: OrdersDeps,
	draftId: string,
	header: string,
	seen: SettlePeek,
	rejection: SettleRejection,
): void => {
	const where = `transaction=${seen.transaction ?? "?"} payer=${seen.payer ?? "?"}`;
	deps.log(
		`orphan payment ${where} reason=${rejection.reason}: ${rejection.error}`,
	);
	try {
		deps.database
			.prepare(ORDERS_SQL.insertOrphan)
			.run(
				seen.transaction,
				seen.payer,
				seen.network,
				header,
				rejection.reason,
				deps.now(),
				draftId,
			);
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		deps.log(
			`OPERATOR ACTION REQUIRED orphan payment ${where} not stored: ${error}`,
		);
	}
};

// The first orphan paid for this draft, resolved or not (ADR 0042); payTx may be unknown.
export const orphanOf = (
	deps: OrdersDeps,
	draftId: string,
): { payTx: string | null } | null => {
	const found = row(
		deps.database.prepare(ORDERS_SQL.orphanByDraft).get(draftId),
	);
	return found ? { payTx: optText(found, "pay_tx") } : null;
};
