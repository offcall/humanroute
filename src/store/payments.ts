// payments table: payment identity (hash of the tx message) -> request fingerprint and job (ADR 0004).
import { int, row, text } from "./columns.js";
import { PAYMENTS_SQL } from "./sql.js";
import type { Database, Payment, PaymentsRepo } from "./types.js";

export const paymentsRepo = (database: Database): PaymentsRepo => {
	const stmts = {
		get: database.prepare(PAYMENTS_SQL.get),
		insert: database.prepare(PAYMENTS_SQL.insert),
	};
	return {
		get: (paymentId: string): Payment | undefined => {
			const found = row(stmts.get.get(paymentId));
			if (!found) {
				return undefined;
			}
			return {
				paymentId: text(found, "payment_id"),
				fingerprint: text(found, "fingerprint"),
				jobId: text(found, "job_id"),
				createdAt: int(found, "created_at"),
			};
		},
		insert: (payment: Payment): void => {
			stmts.insert.run(
				payment.paymentId,
				payment.fingerprint,
				payment.jobId,
				payment.createdAt,
			);
		},
	};
};
