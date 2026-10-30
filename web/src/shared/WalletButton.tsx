import { useState } from "react";
import { useSession } from "./session";
import { shortWallet } from "./WalletLine";
import { getPhantom, phantomDeepLink } from "./wallet";

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
