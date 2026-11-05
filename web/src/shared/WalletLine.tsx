import "./WalletLine.css";
import { useState } from "react";
import { Icon, IconName } from "./Icon";

export const shortWallet = (wallet: string): string =>
	`${wallet.slice(0, 4)}…${wallet.slice(-4)}`;

enum CopyState {
	Idle = "idle",
	Copied = "copied",
	Failed = "failed",
}

const LABELS: [CopyState, IconName, string][] = [
	[CopyState.Idle, IconName.Copy, "Copy"],
	[CopyState.Copied, IconName.Check, "Copied"],
	[CopyState.Failed, IconName.Cross, "Copy failed"],
];

// All three labels share one grid cell, so the button keeps its width.
const CopyLabel = ({ state }: { state: CopyState }) => (
	<span className="copy-label">
		{LABELS.map(([labelState, icon, text]) => (
			<span key={labelState} className={labelState === state ? "" : "is-off"}>
				<Icon name={icon} size={15} />
				{text}
			</span>
		))}
	</span>
);

type Props = {
	wallet: string;
	onSignOut?: () => void;
	// a request in flight that Sign out must not interrupt
	signOutDisabled?: boolean;
};

export const WalletLine = ({ wallet, onSignOut, signOutDisabled }: Props) => {
	const [copyState, setCopyState] = useState(CopyState.Idle);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(wallet);
			setCopyState(CopyState.Copied);
		} catch {
			setCopyState(CopyState.Failed);
		}
	};

	return (
		<div className="wallet-line">
			<span>Wallet</span>
			<code className="wallet-line__addr" title={wallet}>
				{shortWallet(wallet)}
			</code>
			<button type="button" className="btn btn--ghost" onClick={copy}>
				<CopyLabel state={copyState} />
				<span className="visually-hidden"> wallet address</span>
			</button>
			<span className="visually-hidden" role="status">
				{copyState === CopyState.Copied ? "Wallet address copied" : ""}
				{copyState === CopyState.Failed ? "Copy failed" : ""}
			</span>
			<a
				className="btn btn--text"
				href={`https://explorer.solana.com/address/${wallet}?cluster=devnet`}
				target="_blank"
				rel="noreferrer"
			>
				Explorer
				<Icon name={IconName.Ext} size={14} />
				<span className="visually-hidden"> (opens in a new tab)</span>
			</a>
			{onSignOut === undefined ? null : (
				<button
					type="button"
					className="btn btn--ghost"
					disabled={signOutDisabled === true}
					onClick={onSignOut}
				>
					Sign out
				</button>
			)}
		</div>
	);
};
