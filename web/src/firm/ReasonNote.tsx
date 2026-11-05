import type { RefObject } from "react";
import { Icon, IconName } from "../shared";
import { REASON_MAX } from "./rejectReason";

type Props = {
	fieldId: string;
	noteRef: RefObject<HTMLTextAreaElement | null>;
	note: string;
	reason: string;
	required: boolean;
	onChange: (note: string) => void;
};

// Optional note with the counter; shows the reason as it will be sent, or the "required" error.
export const ReasonNote = ({
	fieldId,
	noteRef,
	note,
	reason,
	required,
	onChange,
}: Props) => (
	<div className={required ? "field field--error" : "field"}>
		<label className="field__label" htmlFor={fieldId}>
			Note (optional)
		</label>
		<textarea
			ref={noteRef}
			id={fieldId}
			className="textarea fb-note"
			rows={2}
			maxLength={REASON_MAX}
			placeholder="What is wrong? The translator's agency sees this."
			value={note}
			aria-invalid={required}
			aria-describedby={required ? `${fieldId}-err` : undefined}
			onChange={(event) => onChange(event.target.value)}
		/>
		<div className="fb-note-foot">
			{required ? (
				<p className="inline-error" id={`${fieldId}-err`} role="alert">
					<Icon name={IconName.Alarm} />
					Choose a reason or write a note
				</p>
			) : null}
			{!required && reason !== "" ? (
				<span className="field__hint">Sent as “{reason}”.</span>
			) : null}
			<span className="field__hint fb-count">
				{note.length} / {REASON_MAX}
			</span>
		</div>
	</div>
);
