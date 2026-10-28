import { useCallback, useState } from "react";
import {
	parseFirmRating,
	type FirmRating as Rating,
	request,
	usePoll,
} from "../shared";

export const FirmRating = ({ firmId }: { firmId: string }) => {
	const [rating, setRating] = useState<Rating | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);

	const load = useCallback(async () => {
		const path = `/api/rating/firm/${encodeURIComponent(firmId)}`;
		const res = await request("GET", path, undefined, parseFirmRating);
		if (!res.ok) {
			setError(res.error.message ?? res.error.error);
			return;
		}
		setError(undefined);
		setRating(res.value);
	}, [firmId]);

	usePoll(() => void load());

	if (error !== undefined) {
		return <p className="error">{error}</p>;
	}
	if (rating === undefined) {
		return null;
	}
	if (rating.rejectPct === null) {
		return <p>Reject rate: no decisions yet</p>;
	}

	return (
		<p>
			Reject rate: {rating.rejectPct}% ({rating.rejected} rejected of{" "}
			{rating.approved + rating.rejected} decided)
		</p>
	);
};
