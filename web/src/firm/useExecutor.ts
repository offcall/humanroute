import { useEffect, useState } from "react";
import {
	type AgencyRating,
	type LanguagePair,
	parseAgencyRating,
	parseTaskDetail,
	request,
} from "../shared";

export type ExecutorInfo = {
	pairs: LanguagePair[] | null;
	rating: AgencyRating | undefined;
};

// The claimer's pairs (GET /api/tasks/:id) and the agency rating, loaded once the task has an agency.
export const useExecutor = (
	taskId: string,
	agencyId: string | null,
): ExecutorInfo => {
	const [pairs, setPairs] = useState<LanguagePair[] | null>(null);
	const [rating, setRating] = useState<AgencyRating | undefined>(undefined);

	useEffect(() => {
		if (agencyId === null) {
			return;
		}
		const path = `/api/tasks/${encodeURIComponent(taskId)}`;
		void request("GET", path, undefined, parseTaskDetail).then((res) => {
			if (res.ok) {
				setPairs(res.value.executorPairs);
			}
		});
	}, [taskId, agencyId]);

	useEffect(() => {
		if (agencyId === null) {
			return;
		}
		const path = `/api/rating/agency/${encodeURIComponent(agencyId)}`;
		void request("GET", path, undefined, parseAgencyRating).then((res) => {
			if (res.ok) {
				setRating(res.value);
			}
		});
	}, [agencyId]);

	return { pairs, rating };
};
