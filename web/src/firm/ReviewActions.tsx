import { Icon, IconName, Spinner } from "../shared";
import { Action, type DecisionError } from "./useDecision";

type Props = {
	busy: Action | undefined;
	error: DecisionError | undefined;
	pair: string;
	amount: string;
	sheetId: string;
	sheetOpen: boolean;
	onApprove: () => void;
	onToggleSheet: () => void;
};

const ACTION_WORD: Record<Action, string> = {
	[Action.Approve]: "Approve",
	[Action.Reject]: "Reject",
};

// Approve & pay (indigo) and Reject… (outline); both inert while a decision is sent.
export const ReviewActions = (props: Props) => {
	const { busy, error, pair, amount, sheetId, sheetOpen } = props;
	const approving = busy === Action.Approve;

	return (
		<>
			<div className="review-actions">
				<button
					type="button"
					className="btn btn--primary"
					aria-busy={approving}
					aria-disabled={busy !== undefined}
					onClick={props.onApprove}
				>
					{approving ? <Spinner /> : <Icon name={IconName.Check} />}
					{approving ? "Approving…" : `Approve & pay ${amount}`}
				</button>
				<button
					type="button"
					className="btn btn--ghost"
					aria-disabled={busy !== undefined}
					aria-expanded={sheetOpen}
					aria-controls={sheetId}
					onClick={props.onToggleSheet}
				>
					Reject…
				</button>
			</div>
			{approving ? (
				<p className="visually-hidden" role="status">
					Approving {pair}…
				</p>
			) : null}
			{error?.kind === "failed" ? (
				<p className="inline-error fb-act-err" role="alert">
					<Icon name={IconName.Alarm} />
					{ACTION_WORD[error.action]} failed. Error: {error.code}. Nothing
					changed on this task; try again.
				</p>
			) : null}
		</>
	);
};
