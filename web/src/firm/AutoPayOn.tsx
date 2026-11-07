import { formatUsdc, shortWallet, TxLink } from "../shared";
import { FundsWarning, hasFeeSol } from "./AutoPayState";
import { recallLimit } from "./autopayLimit";
import type { Autopay } from "./autopayParse";
import { WalletFunds } from "./WalletFunds";

type Props = {
	status: Autopay & { delegate: string };
	lastTx: string | undefined;
	busy: boolean;
	onChange: () => void;
	onOff: () => void;
};

// Auto-pay on: what is left, the agent key, the approval transaction, and change or turn off.
export const AutoPayOn = ({ status, lastTx, busy, onChange, onOff }: Props) => {
	const limit = recallLimit(status.delegate);
	const left = status.allowanceUnits;
	const share =
		limit === undefined || limit === 0n
			? undefined
			: Number((left * 100n) / limit);

	return (
		<div className="stack">
			<div className="ap-row">
				<span className="ap-badge ap-badge--on">On</span>
				<h3 className="ap-title ap-grow">Auto-pay by Claude</h3>
				<button
					type="button"
					className="btn btn--text"
					disabled={busy}
					onClick={onChange}
				>
					Change limit
				</button>
				<button
					type="button"
					className="btn btn--text ap-danger"
					disabled={busy || !hasFeeSol(status)}
					onClick={onOff}
				>
					Turn off
				</button>
			</div>
			<p className="ap-left">
				<span className="ap-big">{formatUsdc(left).replace(" USDC", "")}</span>{" "}
				<span className="ap-muted">
					USDC left{limit === undefined ? "" : ` of ${formatUsdc(limit)}`}
				</span>
			</p>
			{share === undefined ? null : (
				<div className="ap-meter" aria-hidden="true">
					<i style={{ width: `${Math.min(share, 100)}%` }} />
				</div>
			)}
			<dl className="ap-kv">
				<dt>Agent key</dt>
				<dd className="mono">{shortWallet(status.delegate)}</dd>
				{lastTx === undefined ? null : (
					<>
						<dt>Approval</dt>
						<dd>
							<TxLink signature={lastTx} /> signed in Phantom
						</dd>
					</>
				)}
				<dt>Wallet</dt>
				<dd>
					<WalletFunds status={status} />
				</dd>
			</dl>
			<FundsWarning status={status} />
		</div>
	);
};
