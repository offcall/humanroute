import { useEffect, useRef } from "react";
import { Icon, IconName } from "../shared";
import { McpBlock } from "./McpBlock";
import type { Mcp } from "./types";
import "./connect.css";
import "./dialog.css";

// Empty-state hero on /firm/jobs while the firm has no orders.
export const ConnectHero = ({ mcp }: { mcp: Mcp }) => (
	<div className="fb-connect-hero">
		<div className="stack">
			<span className="kicker">No jobs yet</span>
			<h1 className="desk-title">Connect Claude</h1>
			<p className="fb-lead">
				Your agent orders human translation here. Add HumanRoute to Claude Code
				once, then ask it to translate. It sends you a pay link; your jobs
				appear on this page.
			</p>
		</div>
		<McpBlock mcp={mcp} />
		<ol className="fb-steps" aria-label="Then">
			<li>
				<b>1</b>
				<span>
					<strong>Run the command</strong> in your terminal. The token is your
					firm's; keep it private.
				</span>
			</li>
			<li>
				<b>2</b>
				<span>
					<strong>Ask Claude</strong> “Translate this leaflet into Spanish,
					French and German with HumanRoute.”
				</span>
			</li>
			<li>
				<b>3</b>
				<span>
					<strong>Pay the link</strong> Claude gives you with Phantom. The USDC
					waits in escrow until you approve.
				</span>
			</li>
		</ol>
	</div>
);

type DialogProps = { mcp: Mcp; onClose: () => void };

// "Connect Claude" panel opened from the jobs header; a modal <dialog> handles focus and Esc.
export const ConnectDialog = ({ mcp, onClose }: DialogProps) => {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		ref.current?.showModal();
	}, []);

	return (
		<dialog
			ref={ref}
			className="fb-dialog panel"
			aria-labelledby="cc-title"
			onClose={onClose}
		>
			<div className="row row--between">
				<h2 className="h2" id="cc-title">
					Connect Claude
				</h2>
				<button
					type="button"
					className="btn btn--text fb-close"
					aria-label="Close"
					onClick={() => ref.current?.close()}
				>
					<Icon name={IconName.Cross} size={20} />
				</button>
			</div>
			<p className="desk-hint">
				Add HumanRoute to Claude Code once. Then ask Claude to translate; it
				sends you a pay link.
			</p>
			<McpBlock mcp={mcp} />
		</dialog>
	);
};
