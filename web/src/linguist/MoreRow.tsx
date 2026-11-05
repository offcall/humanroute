import {
	formatClock,
	formatLeft,
	Icon,
	IconName,
	pairCodes,
	toMs,
	URGENT_MS,
} from "../shared";
import { type BoardRow, RowKind } from "./boardSnapshot";
import { amountOnly, jobLabel, spokenLeft } from "./jobLabel";
import "./more-row.css";

type Props = {
	row: BoardRow;
	now: number;
	agencyName: string;
	busy: boolean;
	onPick: () => void;
};

const TAG: Record<RowKind, string> = {
	[RowKind.Open]: "",
	[RowKind.Taken]: "Taken",
	[RowKind.Closed]: "Closed",
};

// One button per open row (it moves the job into the hero); Taken / Closed rows are inert.
export const MoreRow = ({ row, now, agencyName, busy, onPick }: Props) => {
	const { task } = row;
	const title = `${pairCodes(task.sourceLang, task.targetLang)} · ${amountOnly(task.priceUnits)}`;

	if (row.kind !== RowKind.Open) {
		const label = `${jobLabel(task, agencyName)}, ${TAG[row.kind].toLowerCase()}`;
		return (
			<div className="more-row is-taken">
				<span className="visually-hidden">{label}</span>
				<span className="more-row__when" aria-hidden="true">
					<span className="tag tag--taken">{TAG[row.kind]}</span>
				</span>
				<span aria-hidden="true">
					<b>{title}</b>
					<span className="more-row__sub">{task.firmName}</span>
				</span>
			</div>
		);
	}

	const leftMs = toMs(task.claimDeadline) - now;
	const left = formatLeft(leftMs);
	const timeClass = [
		"more-row__time",
		leftMs < URGENT_MS ? "is-urgent" : "",
		left.length > 4 ? "more-row__time--long" : "",
	];

	return (
		<button
			type="button"
			className="more-row"
			aria-label={`${jobLabel(task, agencyName)}, closes in ${spokenLeft(leftMs)}`}
			aria-disabled={busy}
			onClick={busy ? undefined : onPick}
		>
			<span className="more-row__when">
				<span className={timeClass.filter(Boolean).join(" ")}>{left}</span>
				<span className="more-row__due">
					due {formatClock(task.claimDeadline)}
				</span>
			</span>
			<span>
				<b>{title}</b>
				<span className="more-row__sub">
					{task.firmName} → {agencyName}
				</span>
			</span>
			<Icon name={IconName.Chev} size={22} />
		</button>
	);
};
