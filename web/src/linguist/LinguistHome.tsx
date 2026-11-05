import { useEffect } from "react";
import { navigate, RequireSession, useRoute, useSession } from "../shared";
import { LinguistBody } from "./LinguistBody";
import { Tabbar } from "./Tabbar";
import { type Screen, screenOf, TAB_PATH, TAB_TITLE, Tab } from "./tabs";
import { useBoard } from "./useBoard";
import { useCabinet } from "./useCabinet";

const LinguistShell = ({ screen }: { screen: Screen }) => {
	const { me } = useSession();
	const { cabinet, failed, reload } = useCabinet();
	const board = useBoard();

	if (cabinet === undefined) {
		if (failed === undefined) {
			return <p>Loading…</p>;
		}
		return me?.linguist ? (
			<p className="error">
				Linguist {me.linguist.id}: cabinet unavailable ({failed})
			</p>
		) : (
			<p>You are not in an agency yet. Open an invite link from an agency.</p>
		);
	}

	return (
		<div className="app theme-big">
			<main className="app__main">
				<div className="app__pad">
					<header className="big-head">
						<h1 className="h-title">{TAB_TITLE[screen.tab]}</h1>
						<span>
							{cabinet.agency.name} · translator #{cabinet.translatorNo}
						</span>
					</header>
					<LinguistBody
						screen={screen}
						cabinet={cabinet}
						board={board}
						reload={reload}
					/>
				</div>
			</main>
			<Tabbar current={screen.tab} fresh={board.fresh} />
		</div>
	);
};

// Unknown /linguist/... paths go to the board.
const BoardRedirect = () => {
	useEffect(() => navigate(TAB_PATH[Tab.Board], true), []);

	return null;
};

export const Linguist = () => {
	const screen = screenOf(useRoute());

	return (
		<RequireSession>
			{screen === undefined ? (
				<BoardRedirect />
			) : (
				<LinguistShell screen={screen} />
			)}
		</RequireSession>
	);
};
