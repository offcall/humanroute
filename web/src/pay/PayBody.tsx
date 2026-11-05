import { PaidView } from "./PaidView";
import { AlreadyPaid, DraftGone, LoadFailed, LoadingDraft } from "./PayStates";
import { PayView } from "./PayView";
import { type PageStatus, Step } from "./status";
import type { DraftView } from "./types";
import { getPhantom } from "./wallet";

export const PayBody = (props: {
	status: PageStatus;
	payer: string | undefined;
	guest: boolean;
	onPay: (draft: DraftView) => void;
	onReload: () => void;
}) => {
	const { status } = props;
	switch (status.name) {
		case Step.Loading:
			return <LoadingDraft />;
		case Step.NotFound:
			return <DraftGone />;
		case Step.LoadError:
			return <LoadFailed onRetry={props.onReload} />;
		case Step.AlreadyPaid:
			return <AlreadyPaid orderId={status.orderId} />;
		case Step.Paid:
			return (
				<PaidView
					draft={status.draft}
					result={status.result}
					guest={props.guest}
				/>
			);
		default:
			return (
				<PayView
					draft={status.draft}
					installed={getPhantom() !== undefined}
					paying={status.name === Step.Paying}
					error={status.name === Step.Failed ? status.message : undefined}
					payer={props.payer}
					onPay={() => props.onPay(status.draft)}
				/>
			);
	}
};
