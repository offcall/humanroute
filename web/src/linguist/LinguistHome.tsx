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
	const [saved, setSaved] = useState(0);

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
	// Every Add / Remove is saved at once; the API needs at least one pair.
	const save = async (next: LanguagePair[]) => {
		if (next.length === 0) {
			setSaveError("keep at least one language pair");
			return;
		}
		setEdited(next);
		const res = await request(
			"PUT",
			"/api/linguist/languages",
			{ pairs: next },
			parsePairs,
		);
		if (!res.ok) {
			setEdited(undefined);
			setSaveError(res.error.message ?? res.error.error);
			return;
		}
		setSaveError(undefined);
		await load();
		setEdited(undefined);
		setSaved((count) => count + 1);
	};

	return (
		<div>
			<h1>Linguist cabinet</h1>
			<p>Earned: {formatUsdc(cabinet.earnedUnits)}</p>
			<h2>Language pairs</h2>
			<LanguagePairs value={pairs} onChange={(next) => void save(next)} />
			{saveError === undefined ? null : <p className="error">{saveError}</p>}
			{/* Remounting reloads the board for the saved pairs. */}
			<Board key={saved} onClaimed={load} />
			<MyTasks tasks={cabinet.tasks} onChanged={load} />
		</div>
	);
};

export const Linguist = () => (
	<RequireSession>
		<LinguistHome />
	</RequireSession>
);
