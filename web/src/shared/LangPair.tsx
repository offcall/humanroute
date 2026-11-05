import { pairCodes, pairLabel, pairNames } from "./languages";

type Props = { source: string; target: string; compact?: boolean };

// "en → es" codes with "English → Spanish" names; compact: codes only.
export const LangPair = ({ source, target, compact = false }: Props) => (
	<span className="pair">
		<span aria-hidden="true">
			<b>{pairCodes(source, target)}</b>
			{compact ? null : <span> {pairNames(source, target)}</span>}
		</span>
		<span className="visually-hidden">{pairLabel(source, target)}</span>
	</span>
);
