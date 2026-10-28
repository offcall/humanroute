import { useCallback, useState } from "react";
import {
	formatUsdc,
	type LanguagePair,
	LanguagePairs,
	RequireSession,
	request,
	usePoll,
	useSession,
} from "../shared";
import { Board } from "./Board";
import { MyTasks } from "./MyTasks";
import { type Cabinet, parseCabinet, parsePairs } from "./parseCabinet";

const LinguistHome = () => {
	const { me } = useSession();
	const [cabinet, setCabinet] = useState<Cabinet>();
	const [failed, setFailed] = useState<string>();
	const [edited, setEdited] = useState<LanguagePair[]>();
	const [saveError, setSaveError] = useState<string>();

	const load = useCallback(async () => {
		const res = await request("GET", "/api/linguist", undefined, parseCabinet);
		if (res.ok) {
			setCabinet(res.value);
			setFailed(undefined);
		} else {
			setFailed(res.error.message ?? res.error.error);
		}
	}, []);

	usePoll(load);

	if (cabinet === undefined) {
		if (failed === undefined) {
			return <p>Loading…</p>;
		}
		return me?.linguist ? (
			<p className="error">
				Linguist {me.linguist.id}: cabinet unavailable ({failed})
			</p>
		) : (
			<p>You are not in an agency yet. Open an invite link from an agency.</p>
		);
	}

	const pairs = edited ?? cabinet.pairs;
	const save = async () => {
		const res = await request(
			"PUT",
			"/api/linguist/languages",
			{ pairs },
			parsePairs,
		);
		if (!res.ok) {
			setSaveError(res.error.message ?? res.error.error);
			return;
		}
		setSaveError(undefined);
		setEdited(undefined);
		await load();
	};

	return (
		<div>
			<h1>Linguist cabinet</h1>
			<p>Earned: {formatUsdc(cabinet.earnedUnits)}</p>
			<h2>Language pairs</h2>
			<LanguagePairs value={pairs} onChange={setEdited} />
			<button
				type="button"
				disabled={edited === undefined || pairs.length === 0}
				onClick={save}
			>
				Save pairs
			</button>
			{saveError === undefined ? null : <p className="error">{saveError}</p>}
			<Board onClaimed={load} />
			<MyTasks tasks={cabinet.tasks} onChanged={load} />
		</div>
	);
};

export const Linguist = () => (
	<RequireSession>
		<LinguistHome />
	</RequireSession>
);
