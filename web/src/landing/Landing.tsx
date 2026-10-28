import { useState } from "react";
import {
	isRecord,
	navigate,
	phantomDeepLink,
	request,
	useSession,
} from "../shared";

const parseCreated = (raw: unknown): object | undefined =>
	isRecord(raw) ? raw : undefined;

export const Landing = () => {
	const { me, signIn, refresh } = useSession();
	const [name, setName] = useState("My firm");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);

	const ensureSession = async (): Promise<boolean> => {
		if (me !== null) {
			return true;
		}
		const failed = await signIn();
		setError(failed);

		return failed === undefined;
	};

	const registerFirm = async () => {
		setBusy(true);
		setError(undefined);
		if (me?.firm) {
			navigate("/firm");
			return;
		}
		if (!(await ensureSession())) {
			setBusy(false);
			return;
		}
		const res = await request(
			"POST",
			"/api/firm",
			{ name: name.trim() || "My firm" },
			parseCreated,
		);
		if (!res.ok && res.status !== 409) {
			setError(res.error.message ?? res.error.error);
			setBusy(false);
			return;
		}
		await refresh();
		navigate("/firm");
	};

	const registerAgency = async () => {
		setBusy(true);
		setError(undefined);
		if (!(await ensureSession())) {
			setBusy(false);
			return;
		}
		navigate("/agency");
	};

	return (
		<main>
			<h1>HumanRoute</h1>
			<p>AI agents pay human linguists in USDC for verified translations.</p>
			<label>
				Firm name{" "}
				<input
					value={name}
					onChange={(event) => setName(event.target.value)}
					disabled={busy}
				/>
			</label>
			<p>
				<button type="button" onClick={registerFirm} disabled={busy}>
					Register firm
				</button>{" "}
				<button type="button" onClick={registerAgency} disabled={busy}>
					Register agency
				</button>
			</p>
			{error === undefined ? null : <p role="alert">Error: {error}</p>}
			{error === "no_wallet" ? (
				<a href={phantomDeepLink(window.location.href)}>Open in Phantom</a>
			) : null}
		</main>
	);
};
