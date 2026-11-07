import { Icon, IconName, TxLink } from "../shared";
import { CopyButton } from "./CopyButton";

// The gateway reports money taken without an order (ADR 0042): no Pay, only the operator helps.
export const Orphaned = ({
	draftId,
	payTx,
}: {
	draftId: string;
	payTx: string | null;
}) => (
	<div className="alert alert--error" role="alert">
		<Icon name={IconName.Alarm} size={20} />
		<div>
			<b>
				Money was taken for this draft, but no order was created. Do not pay
				again: contact the operator.
			</b>
			<code className="pay-raw">payment settled without an order</code>
			<p>
				Send the operator the draft id{" "}
				<code className="code-chip">{draftId}</code>
				{payTx === null ? "." : " and the payment transaction:"}
			</p>
			{payTx === null ? null : <TxLink signature={payTx} large />}
			<div className="alert__actions">
				<CopyButton value={draftId} label="Copy draft id" />
			</div>
		</div>
	</div>
);

// A payment for this draft is being settled right now: no Pay until the outcome is known.
export const Settling = ({ onReload }: { onReload: () => void }) => (
	<div className="alert alert--info" role="status">
		<Icon name={IconName.Refresh} size={20} />
		<div>
			<b>A payment for this draft is being settled. Do not pay again.</b>
			<code className="pay-raw">payment settling</code>
			<div className="alert__actions">
				<button
					type="button"
					className="btn btn--primary btn--sm"
					onClick={onReload}
				>
					<Icon name={IconName.Refresh} size={18} />
					Check again
				</button>
			</div>
		</div>
	</div>
);
