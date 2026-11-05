import { useSession, WalletLine } from "../shared";

type Props = { payer: string | undefined; busy: boolean };

// Session wallet with Sign out; a guest payer's wallet without it, once Phantom connected.
export const PayTop = ({ payer, busy }: Props) => {
	const { me, signOut } = useSession();

	return (
		<header className="pay-top">
			<a className="brand-mark" href="/" aria-label="HumanRoute home">
				HR
			</a>
			<b className="pay-top__name">HumanRoute</b>
			{me !== null ? (
				<WalletLine
					wallet={me.wallet}
					onSignOut={signOut}
					signOutDisabled={busy}
				/>
			) : payer !== undefined ? (
				<WalletLine wallet={payer} />
			) : (
				<span className="pay-top__guest">
					Not signed in · paying needs no account
				</span>
			)}
		</header>
	);
};
