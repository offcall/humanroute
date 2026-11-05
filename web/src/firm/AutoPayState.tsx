import { formatUsdc, shortWallet } from "../shared";
import type { Autopay } from "./autopayParse";

// What the chain says now: no USDC account, off, or on for one agent key with the allowance left.
export const AutoPayState = ({ status }: { status: Autopay }) => {
	if (!status.exists) {
		return (
			<p className="error">
				Your wallet has no USDC account yet. Receive devnet USDC first.
			</p>
		);
	}
	const balance =
		status.balanceUnits === undefined
			? ""
			: ` Balance ${formatUsdc(status.balanceUnits)}.`;
	if (status.delegate === null || status.allowanceUnits === 0n) {
		return <p>Auto-pay is off.{balance}</p>;
	}

	return (
		<p>
			Auto-pay is on for agent key{" "}
			<span className="mono">{shortWallet(status.delegate)}</span>:{" "}
			<b>{formatUsdc(status.allowanceUnits)}</b> left.{balance}
		</p>
	);
};
