import { DraftSummary } from "./DraftSummary";
import { failureOf, Next } from "./failure";
import { canRetry, PayAlert } from "./PayAlert";
import { PayCta } from "./PayCta";
import type { DraftView } from "./types";

type Props = {
	draft: DraftView;
	installed: boolean;
	paying: boolean;
	error: string | undefined;
	payer: string | undefined;
	onPay: () => void;
};

// Ready, paying and failed: the draft stays on screen; Pay only where nothing settled.
export const PayView = ({
	draft,
	installed,
	paying,
	error,
	payer,
	onPay,
}: Props) => {
	const retry = error === undefined || canRetry(error);
	// orphan payment: no order, so no escrow promise
	const orphan =
		error !== undefined && failureOf(error).next === Next.CopyDraft;

	return (
		<>
			<DraftSummary draft={draft} promise={!orphan} />
			{error === undefined ? null : (
				<PayAlert message={error} draft={draft} payer={payer} />
			)}
			{retry ? (
				<PayCta
					installed={installed}
					paying={paying}
					totalUnits={draft.totalUnits}
					onPay={onPay}
				/>
			) : null}
		</>
	);
};
