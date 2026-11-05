import { navigate } from "../shared";
import { Board } from "./Board";
import { MyTasks } from "./MyTasks";
import type { Cabinet } from "./parseCabinet";
import { SubmitTask } from "./SubmitTask";
import { type Screen, TAB_PATH, Tab } from "./tabs";
import type { BoardState } from "./useBoard";
import { WalletTab } from "./WalletTab";

type BodyProps = {
	screen: Screen;
	cabinet: Cabinet;
	board: BoardState;
	reload: () => Promise<void>;
};

export const LinguistBody = ({ screen, cabinet, board, reload }: BodyProps) => {
	// A claim or a pair save reloads the cabinet and applies the latest board.
	const reloadAll = async () => {
		await Promise.all([reload(), board.refresh(true)]);
	};

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
		return <WalletTab cabinet={cabinet} reload={reloadAll} />;
	}

	const claimed = (taskId: string) => {
		void reloadAll();
		navigate(`${TAB_PATH[Tab.Tasks]}/${encodeURIComponent(taskId)}`);
	};

	return (
		<Board board={board} agencyName={cabinet.agency.name} onClaimed={claimed} />
	);
};
