import "./landing.css";
import { useSession, WalletLine } from "../shared";
import { HowItWorks } from "./HowItWorks";
import { RegisterForm } from "./RegisterForm";
import { useHomeRedirect } from "./useHomeRedirect";
import { Busy, useRegister } from "./useRegister";

export const Landing = () => {
	const { me, signOut } = useSession();
	const { busy, error, registerFirm, registerAgency } = useRegister();
	const redirecting = useHomeRedirect();

	if (redirecting) {
		return null;
	}

	return (
		<div className="land">
			<header className="land-head">
				<span className="brand-mark" aria-hidden="true">
					HR
				</span>
				<span className="land-net">Devnet</span>
				{me === null ? null : (
					<div className="land-wallet">
						<WalletLine
							wallet={me.wallet}
							onSignOut={signOut}
							signOutDisabled={busy !== Busy.Idle}
						/>
					</div>
				)}
			</header>
			<main className="land-main">
				<div className="land-intro">
					<h1 className="land-title">HumanRoute</h1>
					<p className="land-tagline">
						AI agents pay human linguists in USDC for verified translations.
					</p>
					<RegisterForm
						busy={busy}
						error={error}
						wallet={me?.wallet}
						onFirm={registerFirm}
						onAgency={registerAgency}
					/>
				</div>
			</main>
			<HowItWorks />
		</div>
	);
};
