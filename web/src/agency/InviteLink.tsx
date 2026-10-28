import { useState } from "react";
import { isRecord, request, str } from "../shared";

const parseInvite = (raw: unknown) =>
	isRecord(raw) ? str(raw.url) : undefined;

export const InviteLink = ({ initialUrl }: { initialUrl: string | null }) => {
	const [url, setUrl] = useState(initialUrl);
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const create = async () => {
		setBusy(true);
		setError(null);
		const res = await request("POST", "/api/agency/invite", {}, parseInvite);
		if (res.ok) {
			setUrl(res.value);
		} else {
			setError(res.error.message ?? res.error.error);
		}
		setBusy(false);
	};

	const copy = async (link: string) => {
		try {
			await navigator.clipboard.writeText(link);
			setCopied(true);
		} catch {
			setError("Copy failed, select the link manually");
		}
	};

	return (
		<section>
			<h2>Invite link</h2>
			{url === null ? (
				<button type="button" onClick={create} disabled={busy}>
					Add linguist
				</button>
			) : (
				<>
					<p style={{ fontSize: "1.2rem", wordBreak: "break-all" }}>{url}</p>
					<button type="button" onClick={() => copy(url)}>
						{copied ? "Copied" : "Copy"}
					</button>
				</>
			)}
			{error === null ? null : <p className="error">{error}</p>}
		</section>
	);
};
