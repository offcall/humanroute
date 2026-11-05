import { formatUsdc, shortWallet } from "../shared";
import type { Autopay } from "./autopayParse";

// Approve and revoke cost one signature fee (5000 lamports); keep a margin.
const MIN_FEE_LAMPORTS = 10_000;
export const hasFeeSol = (status: Autopay): boolean =>
	status.solLamports >= MIN_FEE_LAMPORTS;

const NoSol = () => (
	<p className="error">
		Your wallet has no SOL for the network fee (about 0.00001 SOL). Get free
		devnet SOL at{" "}
		<a href="https://faucet.solana.com" target="_blank" rel="noreferrer">
			faucet.solana.com
		</a>{" "}
		(network Devnet, paste your wallet address), then reopen this tab.
	</p>
);

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
	const noSol = hasFeeSol(status) ? null : <NoSol />;
	if (status.delegate === null || status.allowanceUnits === 0n) {
		return (
			<>
				<p>Auto-pay is off.{balance}</p>
				{noSol}
			</>
		);
	}

	return (
		<>
			{noSol}
			<p>
				Auto-pay is on for agent key{" "}
				<span className="mono">{shortWallet(status.delegate)}</span>:{" "}
				<b>{formatUsdc(status.allowanceUnits)}</b> left.{balance}
			</p>
		</>
	);
};
