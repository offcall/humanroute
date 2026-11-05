import { navigate, RequireSession, useSession, WalletLine } from "../shared";
import { FirmBody } from "./FirmBody";
import "./shell.css";

const goHome = (event: React.MouseEvent) => {
	event.preventDefault();
	navigate("/");
};

const FirmHeader = () => {
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
			<span className="desk-top__role">Firm</span>
			{me === null ? null : (
				<WalletLine wallet={me.wallet} onSignOut={signOut} />
			)}
		</header>
	);
};

// Firm shell (Big layout): header with the wallet line, then the routed page.
export const FirmCabinet = () => (
	<div className="theme-big">
		<FirmHeader />
		<main className="desk fb-main">
			<RequireSession>
				<FirmBody />
			</RequireSession>
		</main>
	</div>
);
