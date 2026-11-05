import { Avatar, languageName, pairCodes, type Task } from "../shared";
import { usdcNumber } from "./format";

// Who delivered and the two texts side by side, each with its lang attribute.
export const ReviewTexts = ({ task }: { task: Task }) => (
	<>
		<div className="exec-line">
			<Avatar name={task.agency === null ? null : task.agency.name} />
			<span>
				<b>{pairCodes(task.sourceLang, task.targetLang)}</b>
				{task.agency === null ? null : (
					<>
						{" · "}
						<b>{task.agency.name}</b>
					</>
				)}
				{task.translatorNo === null
					? null
					: ` · translator #${task.translatorNo}`}
				{" · delivered on time · "}
				<b>{usdcNumber(task.priceUnits)} USDC</b>
			</span>
		</div>
		<div className="review-cols">
			<div lang={task.sourceLang} dir="auto">
				<span className="kicker" lang="en">
					{languageName(task.sourceLang)}
				</span>
				{task.text}
			</div>
			<div lang={task.targetLang} dir="auto">
				<span className="kicker" lang="en">
					{languageName(task.targetLang)}
				</span>
				{task.result}
			</div>
		</div>
	</>
);
