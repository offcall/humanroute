import type { ReactNode } from "react";
import { formatUsdc, type Order, TxLink } from "../shared";
import { plural, taskTitle } from "./format";
import "./orders.css";

const titleOf = (order: Order): string => {
	const first = order.tasks[0];

	return first === undefined ? "" : taskTitle(first.text);
};

// Orders under the table: id, title stand-in, tasks, total, paid at, pay tx; children: the reject rate.
export const PaidOrders = ({
	orders,
	children,
}: {
	orders: Order[];
	children: ReactNode;
}) => (
	<div className="fb-orders">
		<p className="kicker">Orders your agent paid for</p>
		<ul>
			{orders.map((order) => (
				<li key={order.orderId}>
					<code className="mono">{order.orderId}</code>
					<span className="fb-orders__title">{titleOf(order)}</span>
					<span>{plural(order.tasks.length, "task")}</span>
					<b>{formatUsdc(order.totalUnits)}</b>
					<span className="muted">
						paid {new Date(order.createdAt).toLocaleString()}
					</span>
					<TxLink signature={order.payTx} />
				</li>
			))}
		</ul>
		{children}
	</div>
);
