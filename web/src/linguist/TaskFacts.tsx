import { type Task, wordCount } from "../shared";
import { amountOnly } from "./jobLabel";

// Pay / Words / Client / Agency
export const TaskFacts = ({ task }: { task: Task }) => (
	<dl className="facts">
		<div>
			<dt>Pay</dt>
			<dd>
				{amountOnly(task.priceUnits)} <small>USDC</small>
			</dd>
		</div>
		<div>
			<dt>Words</dt>
			<dd>{wordCount(task.text)}</dd>
		</div>
		<div>
			<dt>Client</dt>
			<dd>{task.firmName}</dd>
		</div>
		{task.agency === null ? null : (
			<div>
				<dt>Agency</dt>
				<dd>{task.agency.name}</dd>
			</div>
		)}
	</dl>
);
