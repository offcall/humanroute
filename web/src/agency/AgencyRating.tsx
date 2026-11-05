import "./income.css";
import { useState } from "react";
import {
	Icon,
	IconName,
	parseAgencyRating,
	type AgencyRating as Rating,
	request,
	usePoll,
} from "../shared";
import { IncomeNumbers } from "./IncomeNumbers";
import { Loading } from "./Loading";

type Props = { agencyId: string; wallet: string };

export const AgencyRating = ({ agencyId, wallet }: Props) => {
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
		<section
			className="panel ag-income"
			aria-labelledby="ag-income-h"
			aria-busy={rating === null && error === null ? true : undefined}
		>
			<div className="ag-sec-head">
				<h2 className="h2" id="ag-income-h">
					Income
				</h2>
				<span className="ag-sec-head__aside">
					Confirmed payouts only · updates every 3 s
				</span>
			</div>
			{error === null ? null : (
				<p className="alert alert--error" role="alert">
					<Icon name={IconName.Alarm} size={20} />
					<span>
						<b>{error}</b> · could not refresh.
						{rating === null ? "" : " Showing the last numbers."}
					</span>
				</p>
			)}
			{rating === null ? (
				error === null ? (
					<Loading />
				) : null
			) : (
				<IncomeNumbers rating={rating} wallet={wallet} />
			)}
		</section>
	);
};
