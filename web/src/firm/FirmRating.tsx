import { useCallback, useState } from "react";
import {
	parseFirmRating,
	type FirmRating as Rating,
	request,
	usePoll,
} from "../shared";

// Small reject-rate line under the jobs; a failed poll keeps the last value (the jobs alert says so).
export const FirmRating = ({ firmId }: { firmId: string }) => {
	const [rating, setRating] = useState<Rating | undefined>(undefined);

	const load = useCallback(async () => {
		const path = `/api/rating/firm/${encodeURIComponent(firmId)}`;
		const res = await request("GET", path, undefined, parseFirmRating);
		if (res.ok) {
			setRating(res.value);
		}
	}, [firmId]);

	usePoll(() => void load());

	if (rating === undefined) {
		return null;
	}
	if (rating.rejectPct === null) {
		return <p className="fb-rate">Reject rate: no decisions yet</p>;
	}

	return (
		<p className="fb-rate">
			Reject rate: <b>{rating.rejectPct}%</b> ({rating.rejected} rejected of{" "}
			{rating.approved + rating.rejected} decided)
		</p>
	);
};
