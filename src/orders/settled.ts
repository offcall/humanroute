// After x402 settled: order from PAYMENT-RESPONSE -> 201, or orphan row + 502 when no order can be
// recorded (bad settle response, recordOrder failure). transaction and payer are logged first.
import type { Context } from "hono";
import { tasksByOrder } from "../tasks/index.js";
import { orphanBody, recordOrphan } from "./orphan.js";
import { recordOrder } from "./record.js";
import { parseSettleHeader, peekSettle } from "./settle.js";
import {
	type Draft,
	type OrdersDeps,
	type OrdersEnv,
	OrphanReason,
	type Receipt,
} from "./types.js";

// Deferred with setImmediate, so the task reads and push work start after the 201 is
// written; fire-and-forget, an error is only logged.
const announce = (deps: OrdersDeps, orderId: string): void => {
	const { onTasksCreated } = deps;
	if (onTasksCreated === undefined) {
		return;
	}
	const created = () =>
		tasksByOrder(deps.database, orderId).map((task) => ({
			taskId: task.id,
			source: task.sourceLang,
			target: task.targetLang,
			claimDeadline: task.claimDeadline,
		}));
	setImmediate(() => {
		Promise.resolve()
			.then(() => onTasksCreated(created()))
			.catch((err: unknown) =>
				deps.log(
					`tasks created hook failed order ${orderId}: ${err instanceof Error ? err.message : String(err)}`,
				),
			);
	});
};

export const settled = (
	deps: OrdersDeps,
	ctx: Context<OrdersEnv>,
	header: string,
	draft: Draft,
	paymentId: string | null,
): Response => {
	const seen = peekSettle(header);
	deps.log(
		`settled transaction=${seen.transaction ?? "?"} payer=${seen.payer ?? "?"}`,
	);
	const parsed = parseSettleHeader(header, deps.network);
	if ("reason" in parsed) {
		recordOrphan(deps, draft.id, header, seen, parsed);
		return ctx.json(orphanBody(seen.transaction), 502, {
			"PAYMENT-RESPONSE": header,
		});
	}
	let receipt: Receipt;
	try {
		receipt = recordOrder(deps, draft, parsed, paymentId);
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		const reason = OrphanReason.RecordFailed;
		recordOrphan(deps, draft.id, header, seen, { reason, error });
		return ctx.json(orphanBody(seen.transaction), 502, {
			"PAYMENT-RESPONSE": header,
		});
	}
	deps.log(
		`paid order ${receipt.orderId} draft ${draft.id} tasks ${receipt.taskIds.length} pay_tx ${parsed.transaction} payer ${parsed.payer}`,
	);
	announce(deps, receipt.orderId);
	return ctx.json(receipt, 201, { "PAYMENT-RESPONSE": header });
};
