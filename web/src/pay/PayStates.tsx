import { Icon, IconName, Spinner } from "../shared";
import { FirmLink } from "./FirmLink";
import { PayFacts } from "./PaidView";

export const LoadingDraft = () => (
	<>
		<p className="loading" role="status">
			<Spinner />
			Loading draft…
		</p>
		<div className="skeleton pay-skel-num" aria-hidden="true" />
		<div className="stack stack--sm" aria-hidden="true">
			<div className="skeleton skeleton--line" />
			<div className="skeleton skeleton--line pay-w82" />
			<div className="skeleton skeleton--line pay-w64" />
		</div>
	</>
);

export const DraftGone = () => (
	<div className="empty pay-gone">
		<span className="empty__icon">
			<Icon name={IconName.Clock} size={22} />
		</span>
		<p className="empty__title">This pay link has expired</p>
		<code className="pay-raw">draft not found or expired</code>
		<p>Pay links expire after 30 minutes. Ask Claude for a new one.</p>
	</div>
);

export const LoadFailed = ({ onRetry }: { onRetry: () => void }) => (
	<div className="alert alert--error" role="alert">
		<Icon name={IconName.Refresh} size={20} />
		<div>
			<b>We could not load this payment.</b>
			<code className="pay-raw">could not load the draft</code>
			<div className="alert__actions">
				<button
					type="button"
					className="btn btn--ghost btn--sm"
					onClick={onRetry}
				>
					<Icon name={IconName.Refresh} size={18} />
					Try again
				</button>
			</div>
		</div>
	</div>
);

// The draft view has no pay tx and the page does not read its tasks: order id only.
export const AlreadyPaid = ({ orderId }: { orderId: string | undefined }) => (
	<>
		<div className="alert alert--info" role="status">
			<Icon name={IconName.Check} size={20} />
			<div>
				<b>Nothing to pay here.</b>
				<code className="pay-raw">
					this draft is already paid (order {orderId ?? "unknown"})
				</code>
				<div className="alert__actions">
					<FirmLink small />
				</div>
			</div>
		</div>
		{orderId === undefined ? null : <PayFacts orderId={orderId} />}
	</>
);
