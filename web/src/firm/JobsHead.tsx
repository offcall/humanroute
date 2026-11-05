import { Icon, IconName, type Order } from "../shared";

const countLabel = (count: number, word: string): string =>
	`${count} ${word}${count === 1 ? "" : "s"}`;

const countsOf = (orders: Order[]): string => {
	const tasks = orders.reduce((sum, order) => sum + order.tasks.length, 0);
	const orderCount = countLabel(orders.length, "order");

	return orders.length === 0
		? orderCount
		: `${orderCount} · ${countLabel(tasks, "task")}`;
};

type Props = {
	firmName: string;
	orders: Order[] | undefined;
	onConnect: () => void;
};

// "<firm> · Jobs" with counts; "Connect Claude" sits here once the hero is gone.
export const JobsHead = ({ firmName, orders, onConnect }: Props) => (
	<div className="meta-line">
		<span>
			<b>{firmName}</b> · Jobs
		</span>
		{orders === undefined ? null : (
			<span className="fb-meta-right">
				{countsOf(orders)}
				{orders.length === 0 ? null : (
					<button
						type="button"
						className="btn btn--text fb-connect"
						onClick={onConnect}
					>
						<Icon name={IconName.Plus} size={16} />
						Connect Claude
					</button>
				)}
			</span>
		)}
	</div>
);
