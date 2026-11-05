// Agent auto-pay types (ADR 0036). Kept apart from types.ts, which is at its size limit.
import type { PaymentRequirementsV2, ResourceInfo } from "@x402/core/schemas";
import type { Parsed } from "./types.js";

// The gateway's own 402 for POST /x/orders/:draftId: the requirement MCP echoes as `accepted`.
export type Offer = {
	accepted: PaymentRequirementsV2;
	resource: ResourceInfo | undefined;
};

export type Unsigned = {
	transaction: string;
	message: string;
	signer: string;
	amountUnits: string;
	payTo: string;
};

// Kept in MCP memory between prepare_payment and pay_task (ADR 0036).
export type Prepared = Unsigned & Offer & { expiresAt: number };

export type PaidOrder = { orderId: string; payTx: string };

export enum PayOutcome {
	Paid = "paid",
	AlreadyPaid = "already_paid",
}

export type PayResult =
	| { outcome: PayOutcome.Paid; order: PaidOrder }
	| { outcome: PayOutcome.AlreadyPaid };

export type PayClient = {
	offer: (draftId: string) => Promise<Parsed<Offer>>;
	unsigned: (
		token: string,
		draftId: string,
		feePayer: string,
	) => Promise<Parsed<Unsigned>>;
	pay: (draftId: string, paymentHeader: string) => Promise<Parsed<PayResult>>;
};
