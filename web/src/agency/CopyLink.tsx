import { useState } from "react";
import { Icon, IconName } from "../shared";

enum Copy {
	Idle = "idle",
	Copied = "copied",
	Failed = "failed",
}

// The permanent invite link in large mono text; one click selects it all.
export const CopyLink = ({ url }: { url: string }) => {
	const [copy, setCopy] = useState(Copy.Idle);

	const copyUrl = async () => {
		try {
			await navigator.clipboard.writeText(url);
			setCopy(Copy.Copied);
		} catch {
			setCopy(Copy.Failed);
		}
	};
	const copied = copy === Copy.Copied;

	return (
		<>
			<div className="ag-link">
				<code className="ag-link__url">{url}</code>
				<button
					type="button"
					className={
						copied
							? "btn btn--ghost btn--lg ag-copy ag-copy--ok"
							: "btn btn--ghost btn--lg ag-copy"
					}
					onClick={copyUrl}
				>
					<Icon name={copied ? IconName.Check : IconName.Copy} size={18} />
					{copied ? "Copied" : "Copy"}
					{copied ? null : (
						<span className="visually-hidden"> invite link</span>
					)}
				</button>
			</div>
			<p className="visually-hidden" role="status">
				{copied ? "Invite link copied" : ""}
			</p>
			{copy === Copy.Failed ? (
				<p className="inline-error" role="alert">
					<Icon name={IconName.Alarm} size={16} />
					Copy failed, select the link manually
				</p>
			) : null}
		</>
	);
};
