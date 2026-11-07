import { loadDraft } from "./loadDraft";
import { type PageStatus, Step } from "./status";
import type { DraftView } from "./types";

// After an unknown outcome only a paid or orphaned draft changes the page: an unpaid read does not
// prove that nothing settled (it may still be settling).
export const checkStatus = async (failed: {
	draft: DraftView;
	message: string;
}): Promise<PageStatus> => {
	const next = await loadDraft(failed.draft.draftId);
	if (next.name === Step.AlreadyPaid || next.name === Step.Orphaned) {
		return next;
	}

	return { name: Step.Failed, ...failed, checked: true };
};
