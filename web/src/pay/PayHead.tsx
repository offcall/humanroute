import type { ReactNode } from "react";

// "Draft d_7e21ab" kicker above the page title.
export const PayHead = ({
	draftId,
	children,
}: {
	draftId: string;
	children: ReactNode;
}) => (
	<div className="pay__head">
		<p className="kicker">
			Draft <span className="mono">{draftId}</span>
		</p>
		{children}
	</div>
);
