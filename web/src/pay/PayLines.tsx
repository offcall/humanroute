import "./lines.css";
import { LangPair, pairLabel, StatusTag, statusOf, TaskState } from "../shared";
import { formatUsdc } from "./format";
import type { DraftView } from "./types";

type Props = { draft: DraftView; paidOrderId?: string };

const Amount = ({ units }: { units: bigint }) => (
	<span className="pay-lines__amt">
		{formatUsdc(units)} <small>USDC</small>
	</span>
);

// One row per target language; after payment each row carries the new task's Open tag.
export const PayLines = ({ draft, paidOrderId }: Props) => {
	const label =
		paidOrderId === undefined
			? "Tasks in this payment"
			: `Tasks in order ${paidOrderId}`;
	const open = statusOf(TaskState.Open, "open");

	return (
		<ol className="pay-lines" aria-label={label}>
			{draft.targetLangs.map((target) => (
				<li key={target}>
					<b className="pay-lines__pair">
						<LangPair source={draft.sourceLang} target={target} compact />
					</b>
					<span className="pay-lines__name" aria-hidden="true">
						{pairLabel(draft.sourceLang, target)}
					</span>
					{paidOrderId === undefined ? (
						<Amount units={draft.priceUnits} />
					) : (
						<StatusTag status={open} />
					)}
				</li>
			))}
			{paidOrderId === undefined ? (
				<li className="pay-lines__sum">
					<span>
						Total · {draft.taskCount} × {formatUsdc(draft.priceUnits)}
					</span>
					<Amount units={draft.totalUnits} />
				</li>
			) : null}
		</ol>
	);
};
