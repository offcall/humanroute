import {
	CtaBanner,
	Icon,
	IconName,
	navigate,
	pairCodes,
	type Task,
} from "../shared";

const goReview = (event: React.MouseEvent) => {
	event.preventDefault();
	navigate("/firm/review");
};

const fromLine = (task: Task): string => {
	const pair = pairCodes(task.sourceLang, task.targetLang);

	return task.agency === null ? pair : `${pair} from ${task.agency.name}`;
};

type Props = { toReview: Task[]; running: number };

// "N translations wait for your review" + Review now; a quiet line while work runs and nothing waits.
export const ReviewBanner = ({ toReview, running }: Props) => {
	if (toReview.length === 0) {
		return running === 0 ? null : (
			<p className="fb-quiet">
				Nothing to review yet. Translations appear here first as soon as a
				translator submits.
			</p>
		);
	}
	const title =
		toReview.length === 1
			? "1 translation waits for your review"
			: `${toReview.length} translations wait for your review`;

	return (
		<CtaBanner
			title={title}
			detail={toReview.map(fromLine).join(", ")}
			action={
				<a className="btn btn--primary" href="/firm/review" onClick={goReview}>
					Review now
					<Icon name={IconName.Arrow} size={20} />
				</a>
			}
		/>
	);
};
