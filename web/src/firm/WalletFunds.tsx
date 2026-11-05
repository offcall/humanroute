import { formatUsdc } from "../shared";
import type { Autopay } from "./autopayParse";

const LAMPORTS_PER_SOL = 1_000_000_000;

// "20.00 USDC · 0.98 SOL": SOL pays the approve and revoke fees.
export const WalletFunds = ({ status }: { status: Autopay }) => (
	<>
		{status.balanceUnits === undefined
			? "no USDC account"
			: formatUsdc(status.balanceUnits)}
		{" · "}
		{(status.solLamports / LAMPORTS_PER_SOL).toFixed(3)} SOL
	</>
);
