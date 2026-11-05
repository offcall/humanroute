import { Icon, IconName } from "./Icon";

type Props = { signature: string; large?: boolean };

const EXPLORER = "https://explorer.solana.com/tx";

// "2Vx4…9Lm4": first and last 4 characters
export const shortSig = (signature: string): string =>
	signature.length <= 10
		? signature
		: `${signature.slice(0, 4)}…${signature.slice(-4)}`;

export const txUrl = (signature: string): string =>
	`${EXPLORER}/${signature}?cluster=devnet`;

// Short signature linking to the devnet explorer
export const TxLink = ({ signature, large = false }: Props) => (
	<a
		className={large ? "proof proof--lg" : "proof"}
		href={txUrl(signature)}
		target="_blank"
		rel="noreferrer"
	>
		<span className="mono">{shortSig(signature)}</span>
		<Icon name={IconName.Ext} size={large ? 16 : 13} />
		<span className="visually-hidden"> (transaction, opens in a new tab)</span>
	</a>
);
