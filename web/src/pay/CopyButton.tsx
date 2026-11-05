import { useState } from "react";
import { Icon, IconName } from "../shared";

// Copy a value; the label says whether it worked.
export const CopyButton = ({
	value,
	label,
}: {
	value: string;
	label: string;
}) => {
	const [copied, setCopied] = useState<boolean | undefined>(undefined);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	};
	const text = copied === undefined ? label : copied ? "Copied" : "Copy failed";

	return (
		<button type="button" className="btn btn--ghost btn--sm" onClick={copy}>
			<Icon name={copied ? IconName.Check : IconName.Copy} size={16} />
			<span role="status">{text}</span>
		</button>
	);
};
