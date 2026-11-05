import { Icon, IconName, languageName, shortWallet } from "../shared";
import { formatUsdc } from "./format";
import { PayLines } from "./PayLines";
import type { DraftView } from "./types";

const plural = (count: number, word: string): string =>
	`${count} ${word}${count === 1 ? "" : "s"}`;

const EscrowPromise = ({ draft }: { draft: DraftView }) => (
	<>
		<p className="guarantee">
			<Icon name={IconName.Check} size={20} />
			<span>
				<b>Held in escrow, paid to nobody yet.</b> Each translator is paid only
				after you approve the translation. Rejected, late or unclaimed tasks are
				refunded to the paying wallet.
			</span>
		</p>
		<p className="pay-fine">
			<span>
				Pay to escrow{" "}
				<a
					className="proof"
					href={`https://explorer.solana.com/address/${draft.payTo}?cluster=devnet`}
					target="_blank"
					rel="noreferrer"
				>
					<span className="mono">{shortWallet(draft.payTo)}</span>
					<Icon name={IconName.Ext} size={13} />
					<span className="visually-hidden"> (opens in a new tab)</span>
				</a>
			</span>
			<span>USDC · Solana devnet</span>
			<span>Pay links expire after 30 minutes</span>
		</p>
	</>
);

// One big total, the task rows, then the escrow promise and the fine print.
type Props = { draft: DraftView; promise: boolean };

export const DraftSummary = ({ draft, promise }: Props) => (
	<>
		<div className="pay__total">
			<p className="money">
				<b className="num-money">{formatUsdc(draft.totalUnits)}</b>
				<span>USDC (devnet)</span>
			</p>
			<p className="hero-caption">
				{plural(draft.taskCount, "task")},{" "}
				{plural(draft.targetLangs.length, "target language")} · from{" "}
				{languageName(draft.sourceLang)}
			</p>
		</div>
		<PayLines draft={draft} />
		{promise ? <EscrowPromise draft={draft} /> : null}
	</>
);
