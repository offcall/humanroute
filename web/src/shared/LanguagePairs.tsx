import { useState } from "react";
import { Language, type LanguagePair } from "./types";

const MAX_PAIRS = 10;
const languages: string[] = Object.values(Language);

type Props = {
	value: LanguagePair[];
	onChange: (pairs: LanguagePair[]) => void;
};

export const LanguagePairs = ({ value, onChange }: Props) => {
	const [source, setSource] = useState<string>(Language.En);
	const [target, setTarget] = useState<string>(Language.Es);

	const taken = value.some(
		(pair) => pair.source === source && pair.target === target,
	);
	const canAdd = source !== target && !taken && value.length < MAX_PAIRS;

	const remove = (index: number) =>
		onChange(value.filter((_pair, at) => at !== index));

	return (
		<div>
			<ul>
				{value.map((pair, index) => (
					<li key={`${pair.source}-${pair.target}`}>
						{pair.source} → {pair.target}{" "}
						<button type="button" onClick={() => remove(index)}>
							Remove
						</button>
					</li>
				))}
			</ul>
			<select
				value={source}
				onChange={(event) => setSource(event.target.value)}
			>
				{languages.map((code) => (
					<option key={code}>{code}</option>
				))}
			</select>
			<select
				value={target}
				onChange={(event) => setTarget(event.target.value)}
			>
				{languages.map((code) => (
					<option key={code}>{code}</option>
				))}
			</select>
			<button
				type="button"
				disabled={!canAdd}
				onClick={() => onChange([...value, { source, target }])}
			>
				Add
			</button>
		</div>
	);
};
