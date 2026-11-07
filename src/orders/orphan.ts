// Settled but no order: keep an orphans row for the operator (ADR 0016). Refund is manual.

import type { Context } from "hono";
import { optText, row } from "../store/index.js";
import { peekSettle, settleFailure } from "./settle.js";
import { ORDERS_SQL } from "./sql.js";
import {
	type Draft,
	type OrdersDeps,
	type OrdersEnv,
	OrphanReason,
	type SettlePeek,
	type SettleRejection,
} from "./types.js";

export const orphanBody = (payTx: string | null) => ({
	error: "orphan_payment",
	payTx,
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

// A settle that may have broadcast: orphan settle_unknown, never a 402 (ADR 0043).
// The failed PAYMENT-RESPONSE is stored but not sent back.
export const settleUnknown = (
	deps: OrdersDeps,
	ctx: Context<OrdersEnv>,
	header: string | null,
	draft: Draft,
): Response => {
	const seen = peekSettle(header ?? "");
	const failure = header === null ? null : settleFailure(header);
	const error = `settle answered HTTP ${ctx.res.status}${failure ? `: ${failure}` : ""}`;
	const reason = OrphanReason.SettleUnknown;
	recordOrphan(deps, draft.id, header ?? "", seen, { reason, error });
	// Drop the failed response, or Hono copies its headers onto the 502.
	ctx.res = undefined;
	return ctx.json(orphanBody(seen.transaction), 502);
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
