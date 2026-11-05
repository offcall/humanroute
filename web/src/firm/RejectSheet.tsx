import { useRef, useState } from "react";
import { Icon, IconName, pairCodes, Spinner, type Task } from "../shared";
import { usdcNumber } from "./format";
import "./reject.css";
import { ReasonNote } from "./ReasonNote";
import { REASON_CHIPS, type ReasonChip, rejectReason } from "./rejectReason";

type Props = {
	task: Task;
	busy: boolean;
	required: boolean;
	onRequired: () => void;
	onEdit: () => void;
	onReject: (reason: string) => void;
	onCancel: () => void;
};

// Chips + optional note; Reject is never disabled: an empty reason focuses the note with a hint.
export const RejectSheet = (props: Props) => {
	const { task, busy, required, onRequired, onEdit, onReject, onCancel } =
		props;
	const [chips, setChips] = useState<ReasonChip[]>([]);
	const [note, setNote] = useState("");
	const noteRef = useRef<HTMLTextAreaElement>(null);
	const reason = rejectReason(chips, note);
	const sheetId = `reject-${task.taskId}`;
	const amount = usdcNumber(task.priceUnits);

	const toggle = (chip: ReasonChip) => {
		onEdit();
		setChips((prev) =>
			prev.includes(chip)
				? prev.filter((item) => item !== chip)
				: [...prev, chip],
		);
	};
	const submit = () => {
		if (busy) {
			return;
		}
		if (reason === "") {
			noteRef.current?.focus();
			onRequired();
			return;
		}
		onReject(reason);
	};

	return (
		<section
			className="reject-sheet"
			id={sheetId}
			aria-labelledby={`${sheetId}-title`}
		>
			<p className="reject-sheet__title" id={`${sheetId}-title`}>
				Why reject {pairCodes(task.sourceLang, task.targetLang)}? The {amount}{" "}
				USDC goes back to you.
			</p>
			<fieldset className="chips">
				<legend className="visually-hidden">Reason</legend>
				{REASON_CHIPS.map((chip) => (
					<button
						key={chip}
						type="button"
						className="chip"
						aria-pressed={chips.includes(chip)}
						onClick={() => toggle(chip)}
					>
						<Icon name={IconName.Check} />
						{chip}
					</button>
				))}
			</fieldset>
			<ReasonNote
				fieldId={`${sheetId}-note`}
				noteRef={noteRef}
				note={note}
				reason={reason}
				required={required}
				onChange={(value) => {
					onEdit();
					setNote(value);
				}}
			/>
			<div className="row">
				<button
					type="button"
					className="btn btn--danger"
					aria-busy={busy}
					aria-disabled={busy}
					onClick={submit}
				>
					{busy ? <Spinner /> : <Icon name={IconName.Cross} />}
					{busy ? "Rejecting…" : `Reject and refund ${amount}`}
				</button>
				<button type="button" className="btn btn--text" onClick={onCancel}>
					Cancel
				</button>
			</div>
		</section>
	);
};
