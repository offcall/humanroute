import { useState } from "react";
import type { Autopay } from "./autopayParse";

// One terminal command: downloads sign.mjs and setup.mjs from this gateway, creates the agent key
// in ~/.humanroute (mode 600) and prints its public key with a link back here (ADR 0036).
export const setupCommand = (status: Autopay, origin: string): string => {
	const dir = "~/.humanroute";
	const fetchFile = (name: string) =>
		`curl -fsSL ${origin}/agent/${name} -o ${dir}/${name}`;
	const args = `--source ${status.account} --dest ${status.payToAccount} --mint ${status.mint} --cabinet ${origin}/firm/jobs`;

	return `mkdir -p ${dir} && ${fetchFile("sign.mjs")} && ${fetchFile("setup.mjs")} && node ${dir}/setup.mjs ${args}`;
};

const ALLOW_SIGN =
	'{ "permissions": { "allow": ["Bash(node ~/.humanroute/sign.mjs:*)"] } }';

// Step 1: run the command, then "I ran it" opens step 2.
export const AgentSetup = ({
	status,
	onDone,
}: {
	status: Autopay;
	onDone: () => void;
}) => {
	const [copied, setCopied] = useState("Copy");
	const command = setupCommand(status, window.location.origin);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(command);
			setCopied("Copied");
		} catch {
			setCopied("Select and copy by hand");
		}
	};

	return (
		<>
			<p className="ap-muted">
				Run this in the terminal where Claude Code runs (Node 18+). The key
				stays on that machine; the command prints its public key.
			</p>
			<div className="codeblock">
				<pre>{command}</pre>
			</div>
			<div className="ap-row">
				<button type="button" className="btn btn--ghost btn--sm" onClick={copy}>
					{copied}
				</button>
				<button
					type="button"
					className="btn btn--primary btn--sm"
					onClick={onDone}
				>
					I ran it →
				</button>
			</div>
			<details className="ap-details">
				<summary>So Claude signs without asking each time</summary>
				<p className="ap-muted">
					A payment must be signed within about a minute. Add to{" "}
					<code>.claude/settings.json</code>:
				</p>
				<div className="codeblock">
					<pre>{ALLOW_SIGN}</pre>
				</div>
			</details>
		</>
	);
};
