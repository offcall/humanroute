import { useEffect, useRef, useState } from "react";
import { pairCodes, type Task } from "../shared";
import { usdcNumber } from "./format";
import { RejectSheet } from "./RejectSheet";
import { ReviewActions } from "./ReviewActions";
import { ReviewNext } from "./ReviewNext";
import { ReviewTexts } from "./ReviewTexts";
import { Action, useDecision } from "./useDecision";

type Props = {
	task: Task;
	next: Task | undefined;
	position: number;
	total: number;
	onDecided: (taskId: string) => void;
	onConflict: (taskId: string) => void;
	reload: () => void;
};

// One submitted task. Mounted per task (key), so the card is focused and its state fresh on each move.
export const ReviewCard = ({
	task,
	next,
	position,
	total,
	...hooks
}: Props) => {
	const decision = useDecision({ taskId: task.taskId, ...hooks });
	const [sheetOpen, setSheetOpen] = useState(false);
	const cardRef = useRef<HTMLElement>(null);
	const sheetId = `reject-${task.taskId}`;

	useEffect(() => {
		cardRef.current?.focus();
	}, []);

	const toggleSheet = () => {
		if (decision.busy === undefined) {
			setSheetOpen(!sheetOpen);
		}
	};

	return (
		<section
			ref={cardRef}
			className="review-card stack stack--lg"
			tabIndex={-1}
			aria-labelledby="rv-title"
		>
			<div className="review-title">
				<h1 className="num-status" id="rv-title">
					Review
				</h1>
				<span className="review-title__of">
					{position} of {total}
				</span>
			</div>
			<ReviewTexts task={task} />
			<ReviewActions
				busy={decision.busy}
				error={decision.error}
				pair={pairCodes(task.sourceLang, task.targetLang)}
				amount={usdcNumber(task.priceUnits)}
				sheetId={sheetId}
				sheetOpen={sheetOpen}
				onApprove={decision.approve}
				onToggleSheet={toggleSheet}
			/>
			{sheetOpen ? (
				<RejectSheet
					task={task}
					busy={decision.busy === Action.Reject}
					required={decision.error?.kind === "required"}
					onRequired={() => decision.setError({ kind: "required" })}
					onEdit={() => decision.setError(undefined)}
					onReject={decision.reject}
					onCancel={() => setSheetOpen(false)}
				/>
			) : null}
			<ReviewNext next={next} />
		</section>
	);
};
