import { type Task, TxLink } from "../shared";
import { reasonText } from "./reasonText";
import { TimeWord } from "./TimeBits";

// Money moving: the tx once sent, else Queued / Retrying / Stopped.
export const InFlightTime = ({ task }: { task: Task }) => {
	const transfer = task.transfer;
	const why = reasonText(task);
	if (transfer?.status === "failed") {
		return (
			<TimeWord
				word="Stopped"
				line={`${transfer.attempts} attempts · ${why}`}
			/>
		);
	}
	if (transfer?.status === "sent" && transfer.payTx !== null) {
		return (
			<div className="cell-time">
				<TxLink signature={transfer.payTx} />
				<span>{why} · sent</span>
			</div>
		);
	}
	if (transfer !== null && transfer.lastError !== null) {
		return (
			<TimeWord
				word="Retrying"
				line={`${why} · attempt ${transfer.attempts}`}
			/>
		);
	}

	return <TimeWord word="Queued" line={why} />;
};
