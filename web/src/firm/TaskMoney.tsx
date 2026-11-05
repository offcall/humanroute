import { formatClock, type Order, type Task, TxLink } from "../shared";
import { usdcNumber } from "./format";

// "held in escrow", "paid out at 10:14:22", "refunding to you"…
const moneyWords = (task: Task): string => {
	const confirmedAt = task.transfer === null ? null : task.transfer.confirmedAt;
	const at = confirmedAt === null ? "" : ` at ${formatClock(confirmedAt)}`;
	switch (task.publicState) {
		case "paying_out":
			return "USDC paying out";
		case "paid_out":
			return `USDC paid out${at}`;
		case "refunding":
			return "USDC refunding to you";
		case "refunded":
			return `USDC refunded to you${at}`;
		default:
			return "USDC held in escrow";
	}
};

// Big amount with where the money is; the order's pay tx while held, then the task's own transfer.
export const TaskMoney = ({ task, order }: { task: Task; order: Order }) => {
	const transfer = task.transfer;
	const tx = transfer === null ? order.payTx : transfer.payTx;

	return (
		<div className="money">
			<b className="num-money">{usdcNumber(task.priceUnits)}</b>
			<span>
				{moneyWords(task)}
				{tx === null ? null : (
					<>
						{" · "}
						<TxLink signature={tx} large />
					</>
				)}
				{transfer === null ? null : (
					<>
						{" "}
						<span className="muted mono fb-memo">{transfer.memo}</span>
					</>
				)}
			</span>
		</div>
	);
};
