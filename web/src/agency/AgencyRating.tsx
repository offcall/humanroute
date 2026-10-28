import { useState } from "react";
import {
	formatUsdc,
	parseAgencyRating,
	type AgencyRating as Rating,
	request,
	usePoll,
} from "../shared";

export const AgencyRating = ({ agencyId }: { agencyId: string }) => {
	const [rating, setRating] = useState<Rating | null>(null);
	const [error, setError] = useState<string | null>(null);

	usePoll(async () => {
		const res = await request(
			"GET",
			`/api/rating/agency/${encodeURIComponent(agencyId)}`,
			undefined,
			parseAgencyRating,
		);
		if (res.ok) {
			setRating(res.value);
			setError(null);
		} else {
			setError(res.error.error);
		}
	});

	return (
		<section>
			<h2>Income</h2>
			{error === null ? null : <p className="error">{error}</p>}
			{rating === null ? (
				<p>Loading…</p>
			) : (
				<ul>
					<li>Earned: {formatUsdc(rating.paidUnits)}</li>
					<li>
						Rating:{" "}
						{rating.ratingPct === null
							? "no decisions yet"
							: `${rating.ratingPct}%`}
					</li>
					<li>Approved: {rating.approved}</li>
					<li>Rejected: {rating.rejected}</li>
					<li>Late: {rating.late}</li>
				</ul>
			)}
		</section>
	);
};
