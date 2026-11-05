import { type ReactNode, useState } from "react";
import { agentFromUrl } from "./AutoPayForm";
import "./tabs.css";

// Two quiet tabs in the Connect Claude dialog: the MCP command first, auto-pay second.
export const ConnectTabs = ({
	connect,
	autopay,
}: {
	connect: ReactNode;
	autopay: ReactNode;
}) => {
	const [tab, setTab] = useState<"connect" | "autopay">(
		agentFromUrl() === "" ? "connect" : "autopay",
	);
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
