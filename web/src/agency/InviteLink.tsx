import "./invite.css";
import { useState } from "react";
import { Icon, IconName, isRecord, request, Spinner, str } from "../shared";
import { CopyLink } from "./CopyLink";

const parseInvite = (raw: unknown) =>
	isRecord(raw) ? str(raw.url) : undefined;

type Props = { initialUrl: string | null; agencyName: string };

const InlineError = ({ text }: { text: string }) => (
	<p className="inline-error" role="alert">
		<Icon name={IconName.Alarm} size={16} />
		{text}
	</p>
);

export const InviteLink = ({ initialUrl, agencyName }: Props) => {
	const [url, setUrl] = useState(initialUrl);
	const [busy, setBusy] = useState(false);
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

	return (
		<section className="panel ag-invite" aria-labelledby="ag-invite-h">
			<div className="ag-sec-head">
				<h2 className="h2" id="ag-invite-h">
					Invite link
				</h2>
				<span className="ag-sec-head__aside">One link for all linguists</span>
			</div>
			{url === null ? (
				<div className="ag-invite__empty">
					<div>
						<b>No linguists yet</b>
						<p>
							Add linguist creates your permanent invite link. Send it to your
							translators; they join from their phone.
						</p>
					</div>
					<button
						type="button"
						className="btn btn--primary btn--lg"
						aria-busy={busy || undefined}
						aria-disabled={busy || undefined}
						onClick={busy ? undefined : create}
					>
						{busy ? <Spinner /> : <Icon name={IconName.Plus} size={20} />}
						Add linguist
					</button>
				</div>
			) : (
				<CopyLink url={url} />
			)}
			{error === null ? null : <InlineError text={error} />}
			{url === null ? null : (
				<p className="desk-hint">
					The link never changes. A linguist who opens it signs in with Phantom,
					picks their language pairs and joins{" "}
					<span dir="auto">{agencyName}</span>.
				</p>
			)}
		</section>
	);
};
