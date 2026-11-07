// What get_task and wait_task say about a draft without an order (ADR 0042).
import { DraftState, type DraftStatus } from "./types.js";

export const unpaidLines = (status: DraftStatus): string[] => {
	switch (status.state) {
		case DraftState.Orphaned:
			return [
				`payTx: ${status.payTx ?? "unknown"}`,
				"Money was taken for this draft, but no order was created (orphan payment). Do not pay again, by link or auto-pay. Tell the user to contact the operator with the draftId and payTx; the operator refunds by hand.",
			];
		case DraftState.Settling:
			return [
				"A payment for this draft is being settled right now. Do not pay again; call get_task or wait_task to see the result.",
			];
		default:
			return [
				"Not paid yet: waiting for payment by link or authorized agent auto-pay.",
			];
	}
};

export const langNote = (status: DraftStatus): string =>
	status.state === DraftState.Orphaned ? "no order" : "awaiting payment";
