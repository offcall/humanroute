import { navigate, pairCodes, type Task } from "../shared";
import { usdcNumber } from "./format";

const goJobs = (event: React.MouseEvent) => {
	event.preventDefault();
	navigate("/firm/jobs");
};

// What comes after this card: the next task, or the end of the queue.
export const ReviewNext = ({ next }: { next: Task | undefined }) => {
	if (next === undefined) {
		return (
			<p className="next-link fb-last">
				<span>
					Last one in the queue. After this you are back on{" "}
					<a href="/firm/jobs" onClick={goJobs}>
						Jobs
					</a>
					.
				</span>
			</p>
		);
	}

	return (
		<p className="next-link">
			<span>
				Next: <b>{pairCodes(next.sourceLang, next.targetLang)}</b>
				{next.agency === null ? "" : ` · ${next.agency.name}`} ·{" "}
				{usdcNumber(next.priceUnits)} USDC
			</span>
		</p>
	);
};
