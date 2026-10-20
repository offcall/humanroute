// After x402 settled: job from PAYMENT-RESPONSE -> 202, or orphan row + 502 when no job can be
// recorded (bad settle response, recordPaid failure). transaction and payer are logged first.
import type { Context } from "hono";
import { type Job, OrphanReason } from "../store/index.js";
import { orphanBody, recordOrphan } from "./orphan.js";
import { recordPaid } from "./record.js";
import { parseSettleHeader, peekSettle } from "./settle.js";
import { accepted } from "./statusToken.js";
import type { PaymentsDeps, PaymentsEnv, RecordInput } from "./types.js";

type Request = Pick<RecordInput, "body" | "paymentId" | "fingerprint">;

export const settled = (
	deps: PaymentsDeps,
	ctx: Context<PaymentsEnv>,
	header: string,
	request: Request,
): Response => {
	const seen = peekSettle(header);
	deps.log(
		`settled transaction=${seen.transaction ?? "?"} payer=${seen.payer ?? "?"}`,
	);
	const parsed = parseSettleHeader(header, deps.config.network);
	if ("reason" in parsed) {
		recordOrphan(deps, header, seen, parsed);
		return ctx.json(orphanBody(seen), 502, { "PAYMENT-RESPONSE": header });
	}
	let job: Job;
	try {
		job = recordPaid(deps.store, {
			...request,
			settlement: parsed,
			slaSeconds: deps.config.slaSeconds,
			now: deps.now(),
			newId: deps.newId,
		});
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		const reason = OrphanReason.RecordFailed;
		recordOrphan(deps, header, seen, { reason, error });
		return ctx.json(orphanBody(seen), 502, { "PAYMENT-RESPONSE": header });
	}
	deps.log(
		`paid job ${job.id} pay_tx ${parsed.transaction} payer ${parsed.payer}`,
	);
	return ctx.json(accepted(deps.config.statusSecret, job.id), 202, {
		"PAYMENT-RESPONSE": header,
	});
};
