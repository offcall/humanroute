import { useState } from "react";
import { Banner, IconName, Spinner, useClock } from "../shared";
import { BoardHero } from "./BoardHero";
import { RowKind, rowsOf } from "./boardSnapshot";
import { MoreRow } from "./MoreRow";
import type { BoardState } from "./useBoard";
import { useClaim } from "./useClaim";
import "./board-big.css";

type Props = {
	board: BoardState;
	agencyName: string;
	onClaimed: (taskId: string) => void;
};

const jobsWord = (count: number): string =>
	count === 1 ? "1 new job" : `${count} new jobs`;

export const Board = ({ board, agencyName, onClaimed }: Props) => {
	const now = useClock(board.serverTime);
	const [pickedId, setPickedId] = useState<string>();
	const { busy, claimError, claim } = useClaim(onClaimed, board.lose);
	const { snap, loadError, fresh } = board;

	const rows = snap === undefined ? [] : rowsOf(snap, now);
	const open = rows.filter((row) => row.kind === RowKind.Open);
	const hero = open.find((row) => row.task.taskId === pickedId) ?? open[0];
	const others = rows.filter((row) => row !== hero);

	return (
		<>
			{fresh === 0 ? null : (
				<Banner
					sticky
					icon={IconName.Refresh}
					label={`${jobsWord(fresh)} on the board. Show them`}
					onClick={board.show}
				>
					{jobsWord(fresh)} · <u>Show</u>
				</Banner>
			)}
			{loadError === undefined ? null : (
				<p className="error">Board not loaded: {loadError}</p>
			)}
			{snap === undefined && loadError === undefined ? (
				<p className="loading" role="status">
					<Spinner />
					Loading…
				</p>
			) : null}
			{snap !== undefined && open.length === 0 ? (
				<div className="empty">
					<p className="empty__title">No open tasks in your pairs.</p>
				</div>
			) : null}
			{hero === undefined ? null : (
				<BoardHero
					row={hero}
					now={now}
					agencyName={agencyName}
					kicker={`${hero === open[0] ? "Soonest · " : ""}${open.indexOf(hero) + 1} of ${open.length}`}
					busy={busy}
					error={
						claimError?.taskId === hero.task.taskId
							? claimError.message
							: undefined
					}
					onClaim={() => void claim(hero.task.taskId)}
				/>
			)}
			{claimError !== undefined && claimError.taskId !== hero?.task.taskId ? (
				<p className="error">{claimError.message}</p>
			) : null}
			{others.length === 0 ? null : (
				<section
					className={busy ? "more is-busy" : "more"}
					aria-label="More jobs"
				>
					<p className="kicker">More jobs</p>
					{others.map((row) => (
						<MoreRow
							key={row.task.taskId}
							row={row}
							now={now}
							agencyName={agencyName}
							busy={busy}
							onPick={() => setPickedId(row.task.taskId)}
						/>
					))}
				</section>
			)}
		</>
	);
};
