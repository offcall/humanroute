import { useState } from "react";
import { useSession } from "./session";
import { getPhantom, phantomDeepLink } from "./wallet";

const shortWallet = (wallet: string): string =>
	`${wallet.slice(0, 4)}…${wallet.slice(-4)}`;

export const WalletButton = () => {
	const { me, signIn } = useSession();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);

	if (me !== null) {
		return <span className="wallet">{shortWallet(me.wallet)}</span>;
	}
	if (getPhantom() === undefined) {
		return (
			<a className="button" href={phantomDeepLink(window.location.href)}>
				Open in Phantom
			</a>
		);
	}

	const click = async () => {
		setBusy(true);
		setError(await signIn());
		setBusy(false);
	};

	return (
		<>
			<button type="button" disabled={busy} onClick={click}>
				{busy ? "Signing in…" : "Sign in with Phantom"}
			</button>
			{error === undefined ? null : <p className="error">{error}</p>}
		</>
	);
};
