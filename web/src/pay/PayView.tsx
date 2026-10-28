import { formatUsdc } from "./format";
import type { DraftView, PayResult } from "./types";

export const PaidView = ({ result }: { result: PayResult }) => (
	<div>
		<h1>Paid</h1>
		<p>Order {result.orderId}</p>
		<a
			href={`https://explorer.solana.com/tx/${result.payTx}?cluster=devnet`}
			target="_blank"
			rel="noreferrer"
		>
			View payment on Solana Explorer (devnet)
		</a>
	</div>
);

export const ReadyView = ({
	draft,
	installed,
	paying,
	onPay,
}: {
	draft: DraftView;
	installed: boolean;
	paying: boolean;
	onPay: () => void;
}) => (
	<>
		<p>
			{draft.taskCount} tasks, {draft.targetLangs.length} target languages
		</p>
		<p>{formatUsdc(draft.totalUnits)} USDC (devnet)</p>
		{installed ? (
			<button type="button" disabled={paying} onClick={onPay}>
				{paying ? "Paying..." : "Pay with Phantom"}
			</button>
		) : (
			<p>Install Phantom to pay.</p>
		)}
	</>
);
