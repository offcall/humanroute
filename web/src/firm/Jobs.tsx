import { useState } from "react";
import { type Order, useClock } from "../shared";
import { agentFromUrl } from "./AutoPayForm";
import { FirmRating } from "./FirmRating";
import { JobsHead } from "./JobsHead";
import { JobsTable } from "./JobsTable";
import { ConnectDialog, ConnectHero } from "./McpConnection";
import { MoneyHero } from "./MoneyHero";
import { NotUpdated } from "./NotUpdated";
import { PaidOrders } from "./PaidOrders";
import { ReviewBanner } from "./ReviewBanner";
import { sortTasks } from "./sortTasks";
import { summaryOf } from "./summary";
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

type OverviewProps = { orders: Order[]; serverTime: string | undefined };

const Overview = ({ orders, serverTime }: OverviewProps) => {
	const now = useClock(serverTime);
	const summary = summaryOf(orders, now);

	return (
		<>
			<MoneyHero summary={summary} />
			<ReviewBanner toReview={summary.toReview} running={summary.running} />
			<JobsTable tasks={sortTasks(orders)} now={now} />
			{summary.escrowUnits === 0n ? null : (
				<p className="guarantee fb-guarantee">
					Every unfinished job refunds to you automatically at its due time if
					there is no valid answer.
				</p>
			)}
		</>
	);
};

// /firm/jobs
export const Jobs = ({ view }: { view: FirmView }) => {
	const { orders, serverTime, error } = useOrders();
	const [connectOpen, setConnectOpen] = useState(false);
	// The setup command links back with ?agent=; with orders the hero is gone, so open the dialog.
	const [agentLink, setAgentLink] = useState(agentFromUrl() !== "");
	const dialogOpen = connectOpen || (agentLink && (orders?.length ?? 0) > 0);
	const rating = <FirmRating firmId={view.firm.id} />;

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
					{rating}
				</>
			) : null}
			{orders === undefined || orders.length === 0 ? null : (
				<>
					<Overview orders={orders} serverTime={serverTime} />
					<PaidOrders orders={orders}>{rating}</PaidOrders>
				</>
			)}
			{dialogOpen ? (
				<ConnectDialog
					mcp={view.mcp}
					onClose={() => {
						setConnectOpen(false);
						setAgentLink(false);
					}}
				/>
			) : null}
		</>
	);
};
