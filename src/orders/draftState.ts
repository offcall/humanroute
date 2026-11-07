// The state the public draft read reports (ADR 0042).
import { draftKeyOf } from "./capture.js";
import { isExpired } from "./drafts.js";
import { orphanOf } from "./orphan.js";
import { type Draft, DraftState, type OrdersDeps } from "./types.js";

// paid > orphaned (with payTx) > settling > draft (ADR 0042); null when gone.
export const readState = (
	deps: OrdersDeps,
	inflight: Set<string>,
	draft: Draft,
): { state: DraftState; payTx?: string | null } | null => {
	if (draft.orderId !== null) {
		return { state: DraftState.Paid };
	}
	const orphan = orphanOf(deps, draft.id);
	if (orphan !== null) {
		return { state: DraftState.Orphaned, payTx: orphan.payTx };
	}
	if (isExpired(deps, draft)) {
		return null;
	}
	return inflight.has(draftKeyOf(draft.id))
		? { state: DraftState.Settling }
		: { state: DraftState.Draft };
};
