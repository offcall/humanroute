import { useCallback, useState } from "react";
import {
	type BoardTask,
	Countdown,
	formatUsdc,
	navigate,
	parseBoard,
	parseTask,
	request,
	usePoll,
} from "../shared";

type Props = { onClaimed: () => void; onCount: (count: number) => void };
type BoardView = { serverTime: string; tasks: BoardTask[] };

const preview = (text: string): string[] => text.split("\n").slice(0, 2);

export const Board = ({ onClaimed, onCount }: Props) => {
	const [board, setBoard] = useState<BoardView>();
	const [taken, setTaken] = useState<string[]>([]);
	const [error, setError] = useState<string>();
	const [loadError, setLoadError] = useState<string>();

	const load = useCallback(async () => {
		const res = await request("GET", "/api/board", undefined, parseBoard);
		if (res.ok) {
			setBoard(res.value);
			onCount(res.value.tasks.length);
			setLoadError(undefined);
		} else {
			setLoadError(res.error.message ?? res.error.error);
		}
	}, [onCount]);

	usePoll(load);

	const claim = async (taskId: string) => {
		const url = `/api/tasks/${encodeURIComponent(taskId)}/claim`;
		const res = await request("POST", url, {}, parseTask);
		if (res.ok) {
			setError(undefined);
			onClaimed();
			navigate(`/linguist/tasks/${encodeURIComponent(taskId)}`);
			return;
		} else if (res.status === 409) {
			setTaken((ids) => [...ids, taskId]);
		} else {
			setError(res.error.message ?? res.error.error);
		}
		await load();
	};

	return (
		<section>
			{error === undefined ? null : <p className="error">{error}</p>}
			{loadError === undefined ? null : (
				<p className="error">Board not loaded: {loadError}</p>
			)}
			{board === undefined && loadError === undefined ? <p>Loading…</p> : null}
			{board !== undefined && board.tasks.length === 0 ? (
				<p>No open tasks in your pairs.</p>
			) : null}
			<ul>
				{board?.tasks.map((task) => {
					const [first, second] = preview(task.text);

					return (
						<li key={task.taskId}>
							<strong>
								{task.sourceLang} → {task.targetLang}
							</strong>{" "}
							· {formatUsdc(task.priceUnits)} ·{" "}
							<Countdown
								deadline={task.claimDeadline}
								serverTime={board.serverTime}
							/>
							<p>
								{first}
								{second === undefined ? null : <br />}
								{second}
							</p>
							{taken.includes(task.taskId) ? (
								<span>Taken</span>
							) : (
								<button type="button" onClick={() => claim(task.taskId)}>
									Claim
								</button>
							)}
						</li>
					);
				})}
			</ul>
		</section>
	);
};
