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

export const AgentSetup = ({ status }: { status: Autopay }) => (
	<div className="stack">
		<p className="desk-hint">
			1. Create the agent key on the machine where Claude Code runs (Node 18+).
			It stays there; HumanRoute sees only its public key. The scripts are plain
			JavaScript you can read first.
		</p>
		<div className="codeblock">
			<pre>{setupCommand(status, window.location.origin)}</pre>
		</div>
		<p className="desk-hint">
			2. Let Claude run the signer without a prompt, so a payment is signed
			before its blockhash expires (about a minute). Add this to{" "}
			<code>.claude/settings.json</code> (not verified on every Claude Code
			version):
		</p>
		<div className="codeblock">
			<pre>{ALLOW_SIGN}</pre>
		</div>
		<p className="desk-hint">
			3. Paste the printed public key below and enable auto-pay. Codex: add the
			same MCP URL and token in its MCP settings.
		</p>
	</div>
);
