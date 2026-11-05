import { useState } from "react";
import { FirmRating } from "./FirmRating";
import { JobsHead } from "./JobsHead";
import { ConnectDialog, ConnectHero } from "./McpConnection";
import { NotUpdated } from "./NotUpdated";
import { OrderList } from "./OrderList";
import type { FirmView } from "./types";
import { useOrders } from "./useOrders";

const NoOrders = () => (
	<div className="empty fb-empty">
		<p className="empty__title">No orders yet</p>
		<p>
			Paid orders show up here with every translation, who works on it and where
			your money is.
		</p>
	</div>
);

// /firm/jobs
export const Jobs = ({ view }: { view: FirmView }) => {
	const { orders, serverTime, error, reload } = useOrders();
	const [connectOpen, setConnectOpen] = useState(false);

	return (
		<>
			<JobsHead
				firmName={view.firm.name}
				orders={orders}
				onConnect={() => setConnectOpen(true)}
			/>
			{error === undefined ? null : (
				<NotUpdated error={error} serverTime={serverTime} />
			)}
			{orders === undefined && error === undefined ? (
				<p className="loading" role="status">
					Loading jobs…
				</p>
			) : null}
			{orders?.length === 0 ? (
				<>
					<ConnectHero mcp={view.mcp} />
					<NoOrders />
				</>
			) : null}
			{orders === undefined || orders.length === 0 ? null : (
				<OrderList orders={orders} onDone={reload} />
			)}
			<FirmRating firmId={view.firm.id} />
			{connectOpen ? (
				<ConnectDialog mcp={view.mcp} onClose={() => setConnectOpen(false)} />
			) : null}
		</>
	);
};
