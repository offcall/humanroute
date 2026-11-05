import { Icon, IconName, type Task, TaskState } from "../shared";
import { usdcNumber } from "./format";

// A transfer that gave up (ADR 0017/0018): its error and that the money is still held.
export const TransferError = ({ task }: { task: Task }) => {
	const transfer = task.transfer;
	if (
		transfer === null ||
		transfer.status !== "failed" ||
		transfer.lastError === null
	) {
		return null;
	}
	const leg = task.state === TaskState.Approved ? "payout" : "refund";

	return (
		<p className="fb-row-err" role="alert">
			<Icon name={IconName.Alarm} />
			<span>Error: {transfer.lastError}</span>
			<span className="fb-row-err__memo">
				{leg} {transfer.memo} · stopped after {transfer.attempts} attempts · the{" "}
				{usdcNumber(task.priceUnits)} USDC is still in escrow
			</span>
		</p>
	);
};
