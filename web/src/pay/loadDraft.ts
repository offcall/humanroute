import { parseDraftView } from "./parse";
import { type PageStatus, Step } from "./status";
import { DraftState } from "./types";

export const loadDraft = async (draftId: string): Promise<PageStatus> => {
	try {
		const response = await fetch(
			`/api/orders/draft/${encodeURIComponent(draftId)}`,
		);
		if (response.status === 404) {
			return { name: Step.NotFound };
		}
		const parsed = parseDraftView(await response.json());
		if (!response.ok || !parsed.ok) {
			return { name: Step.LoadError };
		}

		const { state, payTx } = parsed.value;
		if (state === DraftState.Paid) {
			return { name: Step.AlreadyPaid, orderId: parsed.value.orderId };
		}
		// Money already moved or is moving: never offer Pay (ADR 0042).
		if (state === DraftState.Orphaned) {
			return { name: Step.Orphaned, draftId, payTx: payTx ?? null };
		}
		if (state === DraftState.Settling) {
			return { name: Step.Settling };
		}

		return { name: Step.Ready, draft: parsed.value };
	} catch {
		return { name: Step.LoadError };
	}
};
