import "./agency.css";
import type { MouseEvent } from "react";
import { navigate, useSession, WalletButton, WalletLine } from "../shared";
import { AgencyCabinet } from "./AgencyCabinet";
import { Loading } from "./Loading";

const goHome = (event: MouseEvent) => {
	event.preventDefault();
	navigate("/");
};

const AgencyHeader = () => {
	const { me, signOut } = useSession();

	return (
		<header className="desk-top">
			<a
				className="brand-mark"
				href="/"
				aria-label="HumanRoute home"
				onClick={goHome}
			>
				HR
			</a>
			<span className="desk-top__name">HumanRoute</span>
			<span className="desk-top__role">Agency</span>
			{me === null ? null : (
				<WalletLine wallet={me.wallet} onSignOut={signOut} />
			)}
		</header>
	);
};

const SignInHero = () => (
	<main className="desk-hero">
		<span className="kicker">Agency cabinet</span>
		<h1 className="desk-title">Sign in to your agency</h1>
		<p className="ag-lead">
			Your invite link for linguists, your income and your rating. Sign in with
			the wallet that owns the agency.
		</p>
		<div className="desk-hero__action">
			<WalletButton />
		</div>
		<p className="desk-hint">
			Phantom asks you to sign a short message. It costs nothing and sends no
			transaction.
		</p>
	</main>
);

// Agency shell (Big layout): header with the wallet line, then sign-in or the cabinet.
export const Agency = () => {
	const { me, loading } = useSession();

	return (
		<div className="theme-big">
			<AgencyHeader />
			{loading ? (
				<main className="ag-main" aria-busy="true">
					<Loading />
				</main>
			) : me === null ? (
				<SignInHero />
			) : (
				<AgencyCabinet wallet={me.wallet} agencyId={me.agency?.id} />
			)}
		</div>
	);
};
