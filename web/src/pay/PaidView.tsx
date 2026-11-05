import "./paid.css";
import { CtaBanner, Icon, IconName, shortSig, txUrl } from "../shared";
import { FirmLink } from "./FirmLink";
import { formatUsdc } from "./format";
import { PayHead } from "./PayHead";
import { PayLines } from "./PayLines";
import type { DraftView, PayResult } from "./types";

type Props = { draft: DraftView; result: PayResult; guest: boolean };

const NEXT_SIGNED_IN =
	"Review each translation in the firm cabinet. Approve pays the translator; reject refunds you.";
const NEXT_GUEST =
	"Claude follows the order with get_task. To review the translations, sign in to the firm cabinet with the firm's wallet.";

export const PayFacts = ({
	orderId,
	payTx,
}: {
	orderId: string;
	payTx?: string;
}) => (
	<>
		<dl className="pay-facts">
			<div>
				<dt>Order</dt>
				<dd>
					<code className="code-chip">{orderId}</code>
				</dd>
			</div>
			{payTx === undefined ? null : (
				<div>
					<dt>Pay tx</dt>
					<dd>
						<code className="code-chip">{shortSig(payTx)}</code>
					</dd>
				</div>
			)}
		</dl>
		{payTx === undefined ? null : (
			<a
				className="proof proof--lg pay-explorer"
				href={txUrl(payTx)}
				target="_blank"
				rel="noreferrer"
			>
				View payment on Solana Explorer (devnet)
				<Icon name={IconName.Ext} size={15} />
			</a>
		)}
	</>
);

// Paid means held: the neutral IN ESCROW stamp, not the final PAID one.
export const PaidView = ({ draft, result, guest }: Props) => (
	<>
		<div className="pay-done">
			<PayHead draftId={draft.draftId}>
				<h1 className="num-status pay-done__word">
					<Icon name={IconName.Check} size={44} />
					Paid
				</h1>
			</PayHead>
			<span className="stamp stamp--escrow stamp--lg" aria-hidden="true">
				<b>IN ESCROW</b> <small>{formatUsdc(draft.totalUnits)} USDC</small>
			</span>
		</div>
		<p className="money">
			<b className="num-money">{formatUsdc(draft.totalUnits)}</b>
			<span>USDC held in escrow</span>
		</p>
		<PayFacts orderId={result.orderId} payTx={result.payTx} />
		<PayLines draft={draft} paidOrderId={result.orderId} />
		<CtaBanner
			title="Translators can claim the tasks now"
			detail={guest ? NEXT_GUEST : NEXT_SIGNED_IN}
			action={<FirmLink />}
		/>
	</>
);
