import { type ReactNode, useState } from "react";
import "./tabs.css";

// Two quiet tabs in the Connect Claude dialog: the MCP command first, auto-pay second.
export const ConnectTabs = ({
	connect,
	autopay,
}: {
	connect: ReactNode;
	autopay: ReactNode;
}) => {
	const [tab, setTab] = useState<"connect" | "autopay">("connect");
	const tabButton = (id: "connect" | "autopay", label: string) => (
		<button
			type="button"
			role="tab"
			aria-selected={tab === id}
			className="fb-tab"
			onClick={() => setTab(id)}
		>
			{label}
		</button>
	);

	return (
		<>
			<div className="fb-tabs" role="tablist" aria-label="Connect Claude">
				{tabButton("connect", "Connect")}
				{tabButton("autopay", "Auto-pay (optional)")}
			</div>
			<div role="tabpanel" className="stack">
				{tab === "connect" ? connect : autopay}
			</div>
		</>
	);
};

// In the empty-state hero: one small text link that opens auto-pay below.
export const AutoPayToggle = ({ children }: { children: ReactNode }) => {
	const [open, setOpen] = useState(false);

	return (
		<div className="fb-autopay-toggle">
			<button
				type="button"
				className="fb-tab"
				aria-expanded={open}
				onClick={() => setOpen(!open)}
			>
				{open ? "Hide auto-pay" : "Auto-pay by Claude (optional)"}
			</button>
			{open ? children : null}
		</div>
	);
};
