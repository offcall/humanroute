import {
	formatClock,
	formatLeft,
	formatUsdc,
	Icon,
	IconName,
	LangPair,
	Spinner,
	toMs,
	URGENT_MS,
	wordsLabel,
} from "../shared";
import type { BoardRow } from "./boardSnapshot";
import { jobLabel, spokenLeft } from "./jobLabel";

type Props = {
	row: BoardRow;
	now: number;
	agencyName: string;
	kicker: string;
	busy: boolean;
	error: string | undefined;
	onClaim: () => void;
};

// Share of the claim window left, counted from when this board first saw the job.
const drainShare = (row: BoardRow, now: number): number => {
	const deadline = toMs(row.task.claimDeadline);
	const span = deadline - row.seenAt;

	return span <= 0 ? 0 : Math.min(1, Math.max(0, (deadline - now) / span));
};

export const BoardHero = (props: Props) => {
	const { row, now, agencyName, busy, error, onClaim } = props;
	const { task } = row;
	const leftMs = toMs(task.claimDeadline) - now;
	const urgent = leftMs < URGENT_MS;
	const price = formatUsdc(task.priceUnits);
	const label = `${jobLabel(task, agencyName)}, closes in ${spokenLeft(leftMs)}`;

	return (
		<>
			<div className={urgent ? "drain-top is-urgent" : "drain-top"}>
				<i style={{ width: `${drainShare(row, now) * 100}%` }} />
			</div>
			<p className="kicker">{props.kicker}</p>
			<div className="hero-time">
				<p
					className={urgent ? "num-hero is-urgent" : "num-hero"}
					role="timer"
					aria-label={`Closes in ${spokenLeft(leftMs)}`}
				>
					{formatLeft(leftMs)}
				</p>
				<p className="hero-caption">
					left to claim · due {formatClock(task.claimDeadline)}
				</p>
			</div>
			{urgent ? (
				<p className="urgent">
					<Icon name={IconName.Alarm} />
					Under 30 seconds to claim
				</p>
			) : null}
			<div className="job-meta">
				<b>
					<LangPair source={task.sourceLang} target={task.targetLang} compact />{" "}
					· {price}
				</b>
				<span>
					<b>{task.firmName}</b> → <b>{agencyName}</b>
					<span className="job-meta__words">{wordsLabel(task.text)}</span>
				</span>
			</div>
			<p className="text-src clamp-2" lang={task.sourceLang} dir="auto">
				{task.text}
			</p>
			<button
				type="button"
				className="btn btn--primary btn--block btn--lg"
				aria-label={busy ? undefined : `Claim: ${label}`}
				aria-busy={busy}
				aria-disabled={busy}
				onClick={busy ? undefined : onClaim}
			>
				{busy ? <Spinner /> : null}
				{busy ? "Claiming…" : `Claim · ${price}`}
			</button>
			{error === undefined ? null : <p className="error">{error}</p>}
		</>
	);
};
