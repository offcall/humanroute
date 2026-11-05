import { useState } from "react";
import { Icon, IconName, Spinner } from "./Icon";
import { useLoginRequest } from "./loginRequest";
import { useSession } from "./session";
import { shortWallet } from "./WalletLine";
import { getPhantom } from "./wallet";

type LoginLinkProps = { className: string; onSignedIn?: () => void };

// No injected provider (Safari, home-screen icon): approve in Phantom, then come back (ADR 0034).
export const LoginLink = ({ className, onSignedIn }: LoginLinkProps) => {
	const { link, failed, opened } = useLoginRequest(onSignedIn);

	if (link === undefined) {
		return (
			<span className={className} aria-busy="true" aria-disabled="true">
				<Spinner />
				{failed ? "Can't reach HumanRoute, retrying…" : "Preparing sign-in…"}
			</span>
		);
	}

	return (
		<a className={className} href={link} onClick={opened}>
			Sign in with Phantom
		</a>
	);
};

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
				<LoginLink className="btn btn--primary btn--lg" />
				<p className="field__hint">
					Phantom opens. Tap Approve there, then come back here.
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
