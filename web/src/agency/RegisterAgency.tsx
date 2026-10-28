import { type FormEvent, useState } from "react";
import { isRecord, parseAgency, request, useSession } from "../shared";

const parseCreated = (raw: unknown) =>
	isRecord(raw) ? parseAgency(raw.agency) : undefined;

export const RegisterAgency = ({ onDone }: { onDone: () => Promise<void> }) => {
	const { refresh } = useSession();
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		setBusy(true);
		setError(null);
		const res = await request(
			"POST",
			"/api/agency",
			{ name: name.trim() },
			parseCreated,
		);
		if (res.ok || res.status === 409) {
			await refresh();
			await onDone();
		} else {
			setError(res.error.message ?? res.error.error);
		}
		setBusy(false);
	};

	return (
		<form onSubmit={submit}>
			<h1>Register your agency</h1>
			<p>
				<input
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder="Agency name"
					aria-label="Agency name"
					required
				/>
			</p>
			<button type="submit" disabled={busy || name.trim() === ""}>
				Create agency
			</button>
			{error === null ? null : <p className="error">{error}</p>}
		</form>
	);
};
