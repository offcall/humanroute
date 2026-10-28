import { useState } from "react";

export type Mcp = { url: string; token: string };

export const McpConnection = ({ mcp }: { mcp: Mcp }) => {
	const [copied, setCopied] = useState<string | undefined>(undefined);
	const command = `claude mcp add --transport http humanroute ${mcp.url} --header "Authorization: Bearer ${mcp.token}"`;

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(command);
			setCopied("Copied");
		} catch {
			setCopied("Copy failed");
		}
	};

	return (
		<section>
			<h3>MCP connection</h3>
			<p>
				URL: <code>{mcp.url}</code>
			</p>
			<p>
				Token: <code>{mcp.token}</code>
			</p>
			<pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
				{command}
			</pre>
			<button type="button" onClick={copy}>
				Copy
			</button>{" "}
			{copied}
		</section>
	);
};
