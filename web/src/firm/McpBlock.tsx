import { useRef, useState } from "react";
import { Icon, IconName } from "../shared";
import { CopyState, type Mcp } from "./types";

export const mcpCommand = (mcp: Mcp): string =>
	`claude mcp add --transport http humanroute ${mcp.url} --header "Authorization: Bearer ${mcp.token}"`;

const COPY_LABEL: Record<CopyState, string> = {
	[CopyState.Idle]: "Copy command",
	[CopyState.Copied]: "Copied",
	[CopyState.Failed]: "Copy failed",
};

const COPY_ICON: Record<CopyState, IconName> = {
	[CopyState.Idle]: IconName.Copy,
	[CopyState.Copied]: IconName.Check,
	[CopyState.Failed]: IconName.Copy,
};

const CopyStatus = ({ copy }: { copy: CopyState }) => {
	if (copy === CopyState.Copied) {
		return (
			<span className="visually-hidden" role="status">
				Command copied
			</span>
		);
	}
	if (copy === CopyState.Failed) {
		return (
			<span className="copy-status copy-status--fail" role="status">
				<Icon name={IconName.Cross} size={15} />
				Select the command and press Ctrl+C
			</span>
		);
	}

	return null;
};

// MCP URL, token and the `claude mcp add` command with a Copy pill.
export const McpBlock = ({ mcp }: { mcp: Mcp }) => {
	const [copy, setCopy] = useState(CopyState.Idle);
	const preRef = useRef<HTMLPreElement>(null);
	const command = mcpCommand(mcp);

	const onCopy = async () => {
		try {
			await navigator.clipboard.writeText(command);
			setCopy(CopyState.Copied);
		} catch {
			setCopy(CopyState.Failed);
			if (preRef.current !== null) {
				window.getSelection()?.selectAllChildren(preRef.current);
			}
		}
	};

	return (
		<div className="mcp">
			<div className="mcp__row">
				<span className="label">URL</span>
				<code>{mcp.url}</code>
			</div>
			<div className="mcp__row">
				<span className="label">Token</span>
				<code>{mcp.token}</code>
			</div>
			<div className="codeblock">
				<pre
					ref={preRef}
					className={copy === CopyState.Failed ? "fb-selected" : undefined}
				>
					{command}
				</pre>
				<div className="codeblock__bar">
					<CopyStatus copy={copy} />
					<button
						type="button"
						className="btn btn--white fb-copy"
						onClick={onCopy}
					>
						<Icon name={COPY_ICON[copy]} size={15} />
						{COPY_LABEL[copy]}
					</button>
				</div>
			</div>
		</div>
	);
};
