import {
	formatUsdc,
	Icon,
	IconName,
	type AgencyRating as Rating,
} from "../shared";

type Props = { rating: Rating; wallet: string };

const RatingNumber = ({ rating }: { rating: Rating }) => {
	const decided = rating.approved + rating.rejected + rating.late;

	return (
		<div className="ag-income__rating">
			<span className="kicker">Rating</span>
			{rating.ratingPct === null ? (
				<>
					<b className="ag-norating">No decisions yet</b>
					<span className="hero-caption">
						Rating appears when a firm approves or rejects a task, or a task
						runs late.
					</span>
				</>
			) : (
				<>
					<b className="num-money">{rating.ratingPct}%</b>
					<span className="hero-caption">
						{rating.approved} approved of {decided} decided
					</span>
				</>
			)}
		</div>
	);
};

// One main number (rating), then earned and the three counts.
export const IncomeNumbers = ({ rating, wallet }: Props) => (
	<>
		<div className="ag-income__grid">
			<RatingNumber rating={rating} />
			<div className="ag-income__earned">
				<span className="kicker">Earned</span>
				<b
					className={
						rating.paidUnits === 0n ? "ag-earned is-zero" : "ag-earned"
					}
				>
					{formatUsdc(rating.paidUnits)}
					<small>USDC</small>
				</b>
				<span className="hero-caption">
					Your share of approved tasks, all time
				</span>
				<a
					className="btn btn--text ag-earned-link"
					href={`https://explorer.solana.com/address/${wallet}?cluster=devnet`}
					target="_blank"
					rel="noreferrer"
				>
					See payouts on Explorer
					<Icon name={IconName.Ext} size={14} />
					<span className="visually-hidden"> (opens in a new tab)</span>
				</a>
			</div>
		</div>
		<div className="ag-income__foot">
			<dl className="stats ag-stats">
				<div>
					<dt>Approved</dt>
					<dd>{rating.approved}</dd>
				</div>
				<div>
					<dt>Rejected</dt>
					<dd>{rating.rejected}</dd>
				</div>
				<div>
					<dt>Late</dt>
					<dd>{rating.late}</dd>
				</div>
			</dl>
			<p className="ag-formula">
				Rating = approved ÷ (approved + rejected + late). Firms see these four
				numbers next to every task your linguists take.
			</p>
		</div>
	</>
);
