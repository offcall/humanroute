import { initials, shortWallet } from "../shared";

// The cabinet's hero: initials, agency name, payout wallet.
export const AgencyPlate = ({
	name,
	wallet,
}: {
	name: string;
	wallet: string;
}) => (
	<div className="ag-plate">
		<span className="avatar avatar--lg" aria-hidden="true">
			{initials(name)}
		</span>
		<div className="ag-plate__text">
			<span className="kicker">Agency</span>
			<h1 className="desk-title" dir="auto">
				{name}
			</h1>
		</div>
		<p className="ag-plate__aside">
			Payouts go to
			<br />
			<code className="code-chip">{shortWallet(wallet)}</code>
		</p>
	</div>
);
