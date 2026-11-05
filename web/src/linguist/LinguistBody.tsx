import { navigate } from "../shared";
import { Board } from "./Board";
import { MyTasks } from "./MyTasks";
import type { Cabinet } from "./parseCabinet";
import { TaskScreen } from "./TaskScreen";
import { type Screen, TAB_PATH, Tab } from "./tabs";
import type { BoardState } from "./useBoard";
import { WalletTab } from "./WalletTab";

type BodyProps = {
	screen: Screen;
	cabinet: Cabinet;
	board: BoardState;
	reload: () => Promise<void>;
	todayUnits: bigint;
};

export const LinguistBody = (props: BodyProps) => {
	const { screen, cabinet, board, reload } = props;
	// A claim or a pair save reloads the cabinet and applies the latest board.
	const reloadAll = async () => {
		await Promise.all([reload(), board.refresh(true)]);
	};

	if (screen.taskId !== undefined) {
		return (
			<TaskScreen
				key={screen.taskId}
				taskId={screen.taskId}
				fresh={board.fresh}
				todayUnits={props.todayUnits}
				onSubmitted={() => void reload()}
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
