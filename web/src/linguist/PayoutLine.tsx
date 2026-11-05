import { type Transfer, TxLink } from "../shared";

type Props = { transfer: Transfer; refund: boolean };

const SENDING = new Set(["pending", "sent"]);

// "Payout tx 8kQe…T3vN hr:t_a81f2c" and, while in flight, "Transfer · Sent"
export const PayoutLine = ({ transfer, refund }: Props) => (
	<>
		<p className="memo-line">
			<span className="muted">{refund ? "Refund tx" : "Payout tx"}</span>
			{transfer.payTx === null ? null : (
				<TxLink signature={transfer.payTx} large />
			)}
			<code className="code-chip">{transfer.memo}</code>
		</p>
		{SENDING.has(transfer.status) ? (
			<p className="memo-line">
				<span className="muted">Transfer</span>
				<span className="tag tag--sent">
					<i className="dot dot--pulse" aria-hidden="true" />
					{transfer.status === "sent" ? "Sent" : "Pending"}
				</span>
			</p>
		) : null}
	</>
);
