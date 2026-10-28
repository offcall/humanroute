import { useState } from "react";
import {
	getPhantom,
	isRecord,
	matchPath,
	navigate,
	phantomDeepLink,
	request,
	useRoute,
	useSession,
} from "../shared";

const parseJoined = (raw: unknown): true | undefined =>
	isRecord(raw) ? true : undefined;

export const JoinPage = () => {
	const path = useRoute();
	const inviteCode = matchPath("/join/:inviteCode", path)?.inviteCode;
	const { me, loading, signIn, refresh } = useSession();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();

	if (inviteCode === undefined) {
		return <p className="error">Invite not found</p>;
	}
	if (getPhantom() === undefined) {
		return (
			<div>
				<h1>Join an agency</h1>
				<a className="button" href={phantomDeepLink(window.location.href)}>
					Open in Phantom
				</a>
			</div>
		);
	}

	const join = async () => {
		setBusy(true);
		setError(undefined);
		if (me === null) {
			const failed = await signIn();
			if (failed !== undefined) {
				setError(`Sign-in failed: ${failed}`);
				setBusy(false);
				return;
			}
		}

		const url = `/api/linguist/join/${encodeURIComponent(inviteCode)}`;
		const res = await request("POST", url, {}, parseJoined);
		if (res.ok) {
			await refresh();
			navigate("/linguist");
			return;
		}
		setError(
			res.status === 404
				? "Invite not found"
				: res.status === 409
					? "You already belong to another agency"
					: (res.error.message ?? res.error.error),
		);
		setBusy(false);
	};

	return (
		<div>
			<h1>Join an agency</h1>
			<button type="button" disabled={busy || loading} onClick={join}>
				{me === null ? "Sign in and join" : "Join"}
			</button>
			{error === undefined ? null : <p className="error">{error}</p>}
		</div>
	);
};
