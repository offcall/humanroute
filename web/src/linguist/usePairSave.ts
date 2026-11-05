import { useState } from "react";
import { type LanguagePair, request } from "../shared";
import { parsePairs } from "./parseCabinet";

// Every Add / Remove is saved at once; the API needs at least one pair.
export const usePairSave = (
	saved: LanguagePair[],
	reload: () => Promise<void>,
) => {
	const [edited, setEdited] = useState<LanguagePair[]>();
	const [saveError, setSaveError] = useState<string>();

	const save = async (next: LanguagePair[]) => {
		if (next.length === 0) {
			setSaveError("keep at least one language pair");
			return;
		}
		setEdited(next);
		const res = await request(
			"PUT",
			"/api/linguist/languages",
			{ pairs: next },
			parsePairs,
		);
		if (!res.ok) {
			setEdited(undefined);
			setSaveError(res.error.message ?? res.error.error);
			return;
		}
		setSaveError(undefined);
		await reload();
		setEdited(undefined);
	};

	return { pairs: edited ?? saved, saveError, save };
};
