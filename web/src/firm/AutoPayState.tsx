import type { Autopay } from "./autopayParse";

// Approve and revoke cost one signature fee (5000 lamports); keep a margin.
const MIN_FEE_LAMPORTS = 10_000;
export const hasFeeSol = (status: Autopay): boolean =>
	status.solLamports >= MIN_FEE_LAMPORTS;

// Why Phantom cannot approve yet: no USDC account, or no SOL for the network fee.
export const FundsWarning = ({ status }: { status: Autopay }) => {
	if (!status.exists) {
		return (
			<p className="error">
				Your wallet has no USDC account yet. Receive devnet USDC first.
			</p>
		);
	}
	if (hasFeeSol(status)) {
		return null;
	}

	return (
		<p className="error">
			Your wallet has no SOL for the network fee (about 0.00001 SOL). Get free
			devnet SOL at{" "}
			<a href="https://faucet.solana.com" target="_blank" rel="noreferrer">
				faucet.solana.com
			</a>{" "}
			(network Devnet, paste your wallet address), then try again.
		</p>
	);
};
