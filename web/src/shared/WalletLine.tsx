import { useState } from "react";

export const shortWallet = (wallet: string): string =>
	`${wallet.slice(0, 4)}…${wallet.slice(-4)}`;

export const WalletLine = ({ wallet }: { wallet: string }) => {
	const [copied, setCopied] = useState(false);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(wallet);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	};

	return (
		<p className="wallet-line">
			Wallet: <span className="wallet">{shortWallet(wallet)}</span>{" "}
			<button type="button" onClick={copy}>
				{copied ? "Copied" : "Copy"}
			</button>{" "}
			<a
				href={`https://explorer.solana.com/address/${wallet}?cluster=devnet`}
				target="_blank"
				rel="noreferrer"
			>
				Explorer
			</a>
		</p>
	);
};
