import {
	formatClock,
	Stamp,
	StampKind,
	type Task,
	TaskState,
	TxLink,
} from "../shared";
import { reasonText } from "./reasonText";

const PAID = "paid_out";

// PAID stamp (confirmation time) or LATE stamp, then the tx; other refunds: tx and why.
export const SettledTime = ({ task }: { task: Task }) => {
	const transfer = task.transfer;
	const tx =
		transfer === null || transfer.payTx === null ? null : (
			<TxLink signature={transfer.payTx} />
		);
	const why = reasonText(task);
	const paid = task.publicState === PAID;
	if (!paid && task.state !== TaskState.ExpiredLate) {
		return (
			<div className="cell-time">
				{tx}
				<span>{why}</span>
			</div>
		);
	}
	const confirmedAt = transfer === null ? null : transfer.confirmedAt;
	const paidNote = confirmedAt === null ? "" : formatClock(confirmedAt);

	return (
		<div className="cell-time fb-final">
			<Stamp
				kind={paid ? StampKind.Paid : StampKind.Late}
				note={paid ? paidNote : "refunded"}
				still
			/>
			<div>
				{tx}
				{paid ? null : <span>{why}</span>}
			</div>
		</div>
	);
};
