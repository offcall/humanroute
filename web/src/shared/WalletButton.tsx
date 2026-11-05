import { useState } from "react";
import { Icon, IconName, Spinner } from "./Icon";
import { useSession } from "./session";
import { shortWallet } from "./WalletLine";
import { getPhantom, phantomDeepLink } from "./wallet";

export const WalletButton = () => {
	const { me, signIn } = useSession();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);

	if (me !== null) {
		return <code className="wallet-line__addr">{shortWallet(me.wallet)}</code>;
	}
	if (getPhantom() === undefined) {
		return (
			<div className="stack stack--sm">
				<a
					className="btn btn--primary btn--lg"
					href={phantomDeepLink(window.location.href)}
				>
					Open in Phantom
				</a>
				<p className="field__hint">
					No Phantom in this browser. Open this page in the Phantom app to sign
					in.
				</p>
			</div>
		);
	}

	const click = async () => {
		setBusy(true);
		setError(await signIn());
		setBusy(false);
	};

	return (
		<div className="stack stack--sm">
			<button
				type="button"
				className="btn btn--primary btn--lg"
				disabled={busy}
				aria-busy={busy}
				onClick={click}
			>
				{busy ? <Spinner /> : null}
				{busy ? "Signing in…" : "Sign in with Phantom"}
			</button>
			{busy ? (
				<p className="field__hint">
					Phantom is asking you to sign the sign-in message.
				</p>
			) : null}
			{error === undefined ? null : (
				<p className="inline-error" role="alert">
					<Icon name={IconName.Alarm} />
					{error}
				</p>
			)}
		</div>
	);
};
