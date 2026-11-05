import { useId } from "react";
import { LANGUAGES, languageName } from "./languages";

// Labelled language select with English names
export const LangSelect = (props: {
	label: string;
	value: string;
	onChange: (code: string) => void;
}) => {
	const selectId = useId();

	return (
		<div className="field">
			<label className="field__label" htmlFor={selectId}>
				{props.label}
			</label>
			<select
				className="select"
				id={selectId}
				value={props.value}
				onChange={(event) => props.onChange(event.target.value)}
			>
				{LANGUAGES.map((code) => (
					<option key={code} value={code}>
						{languageName(code)}
					</option>
				))}
			</select>
		</div>
	);
};
