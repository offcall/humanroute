import { Avatar, LanguagePairs, useSession, WalletLine } from "../shared";
import { amountOnly } from "./jobLabel";
import { PushCard } from "./PushCard";
import type { Cabinet } from "./parseCabinet";
import { usePairSave } from "./usePairSave";
import "./wallet.css";

type Props = { cabinet: Cabinet; reload: () => Promise<void> };

export const WalletTab = ({ cabinet, reload }: Props) => {
	const { me, signOut } = useSession();
	const { pairs, saveError, save } = usePairSave(cabinet.pairs, reload);

	return (
		<>
			<div className="money">
				<p className="num-money">{amountOnly(cabinet.earnedUnits)}</p>
				<span>USDC earned</span>
			</div>
			<p className="hero-caption">Your share of confirmed payouts, all time.</p>
			<div className="plate">
				<Avatar name={cabinet.agency.name} small />
				<span className="plate__who">
					<span className="label label--sm">Agency</span>
					<b>{cabinet.agency.name}</b>
				</span>
				<span className="plate__aside">translator #{cabinet.translatorNo}</span>
			</div>
			{me === null ? null : (
				<div className="wallet-row">
					<WalletLine wallet={me.wallet} onSignOut={signOut} />
				</div>
			)}
			<section className="pairs" aria-labelledby="pairs-head">
				<h2 className="kicker" id="pairs-head">
					Language pairs
				</h2>
				<p className="field__hint">
					The board shows jobs in these pairs. Every change saves at once.
				</p>
				<LanguagePairs value={pairs} onChange={(next) => void save(next)} />
				{saveError === undefined ? null : <p className="error">{saveError}</p>}
			</section>
			<PushCard />
		</>
	);
};
