import { WalletButton } from "../shared";
import { InstallHint } from "./InstallHint";

// Signed-out linguist cabinet: in Safari or the icon, WalletButton runs the login request (ADR 0034).
export const SignedOut = () => (
	<div className="app theme-big">
		<main className="app__main">
			<div className="app__pad stack">
				<header className="row">
					<span className="brand-mark" aria-hidden="true">
						HR
					</span>
					<b>HumanRoute</b>
				</header>
				<div className="stack stack--sm">
					<span className="kicker">For translators</span>
					<h1>Your tasks and payouts</h1>
					<p className="muted">
						Sign in with the Phantom wallet you joined with.
					</p>
				</div>
				<WalletButton />
				<InstallHint />
			</div>
		</main>
	</div>
);
