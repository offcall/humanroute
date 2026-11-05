import { useEffect, useState } from "react";
import { navigate, RequireSession, useRoute, useSession } from "../shared";
import { Board } from "./Board";
import { MyTasks } from "./MyTasks";
import type { Cabinet } from "./parseCabinet";
import { SubmitTask } from "./SubmitTask";
import { Tabbar } from "./Tabbar";
import { type Screen, screenOf, TAB_PATH, TAB_TITLE, Tab } from "./tabs";
import { useCabinet } from "./useCabinet";
import { WalletTab } from "./WalletTab";

type BodyProps = {
	screen: Screen;
	cabinet: Cabinet;
	reload: () => Promise<void>;
	onBoardCount: (count: number) => void;
};

const Body = ({ screen, cabinet, reload, onBoardCount }: BodyProps) => {
	if (screen.taskId !== undefined) {
		return (
			<SubmitTask
				key={screen.taskId}
				taskId={screen.taskId}
				onSubmitted={reload}
				onClose={() => navigate(TAB_PATH[Tab.Tasks])}
			/>
		);
	}
	if (screen.tab === Tab.Tasks) {
		return <MyTasks tasks={cabinet.tasks} />;
	}
	if (screen.tab === Tab.Wallet) {
		return <WalletTab cabinet={cabinet} reload={reload} />;
	}

	return <Board onClaimed={reload} onCount={onBoardCount} />;
};

const LinguistShell = ({ screen }: { screen: Screen }) => {
	const { me } = useSession();
	const { cabinet, failed, reload } = useCabinet();
	const [boardCount, setBoardCount] = useState(0);

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
					<Body
						screen={screen}
						cabinet={cabinet}
						reload={reload}
						onBoardCount={setBoardCount}
					/>
				</div>
			</main>
			<Tabbar current={screen.tab} boardCount={boardCount} />
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
