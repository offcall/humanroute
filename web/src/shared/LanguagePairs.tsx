import "./LanguagePairs.css";
import { type ReactNode, useState } from "react";
import { Icon, IconName } from "./Icon";
import { LangSelect } from "./LangSelect";
import { pairCodes, pairLabel, pairNames } from "./languages";
import { Language, type LanguagePair } from "./types";

const MAX_PAIRS = 10;

type Props = {
	value: LanguagePair[];
	onChange: (pairs: LanguagePair[]) => void;
	// save error shown under the Add row
	error?: ReactNode;
};

export const LanguagePairs = ({ value, onChange, error }: Props) => {
	const [source, setSource] = useState<string>(Language.En);
	const [target, setTarget] = useState<string>(Language.Es);

	const taken = value.some(
		(pair) => pair.source === source && pair.target === target,
	);
	const canAdd = source !== target && !taken && value.length < MAX_PAIRS;

	const remove = (index: number) =>
		onChange(value.filter((_pair, at) => at !== index));

	return (
		<div className="stack">
			<ul className="pair-list">
				{value.map((pair, index) => (
					<li key={`${pair.source}-${pair.target}`}>
						<span>
							<b>{pairCodes(pair.source, pair.target)}</b>
							<span className="muted pair-list__names">
								{pairNames(pair.source, pair.target)}
							</span>
						</span>
						<button
							type="button"
							className="btn btn--ghost btn--sm"
							aria-label={`Remove ${pairLabel(pair.source, pair.target)}`}
							onClick={() => remove(index)}
						>
							Remove
						</button>
					</li>
				))}
			</ul>
			<div className="pair-add">
				<LangSelect label="From" value={source} onChange={setSource} />
				<span className="pair-add__arrow" aria-hidden="true">
					<Icon name={IconName.Arrow} size={20} />
				</span>
				<LangSelect label="To" value={target} onChange={setTarget} />
				<button
					type="button"
					className="btn btn--primary btn--sm"
					disabled={!canAdd}
					onClick={() => onChange([...value, { source, target }])}
				>
					<Icon name={IconName.Plus} />
					Add
				</button>
			</div>
			{error}
		</div>
	);
};
