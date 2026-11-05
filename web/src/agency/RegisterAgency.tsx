import "./register.css";
import { type FormEvent, useState } from "react";
import {
	Icon,
	IconName,
	isRecord,
	parseAgency,
	request,
	Spinner,
	useSession,
} from "../shared";
import { NextSteps } from "./NextSteps";

const parseCreated = (raw: unknown) =>
	isRecord(raw) ? parseAgency(raw.agency) : undefined;

type Props = { wallet: string; onDone: () => Promise<void> };

export const RegisterAgency = ({ wallet, onDone }: Props) => {
	const { refresh } = useSession();
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (busy) {
			return;
		}
		setBusy(true);
		setError(null);
		const body = { name: name.trim() };
		const res = await request("POST", "/api/agency", body, parseCreated);
		if (res.ok || res.status === 409) {
			await refresh();
			await onDone();
		} else {
			setError(res.error.message ?? res.error.error);
		}
		setBusy(false);
	};

	return (
		<main className="ag-main">
			<div className="stack">
				<span className="kicker">New agency</span>
				<h1 className="desk-title">Register your agency</h1>
				<p className="ag-lead">
					Firms order translations from HumanRoute. Your linguists take the
					jobs, and your agency gets its share of every approved task.
				</p>
			</div>
			<form className="panel ag-form" onSubmit={submit}>
				<div className="field">
					<label className="field__label" htmlFor="agency-name">
						Agency name
					</label>
					<div className="ag-form__row">
						<input
							className="input"
							dir="auto"
							id="agency-name"
							name="name"
							placeholder="Agency name"
							autoComplete="organization"
							required
							value={name}
							aria-describedby={error === null ? undefined : "ag-reg-error"}
							onChange={(event) => setName(event.target.value)}
						/>
						<button
							type="submit"
							className="btn btn--primary btn--lg"
							disabled={!busy && name.trim() === ""}
							aria-busy={busy || undefined}
							aria-disabled={busy || undefined}
						>
							{busy ? <Spinner /> : null}
							Create agency
						</button>
					</div>
					<span className="field__hint">
						Firms see this name next to every task your linguists take.
					</span>
				</div>
				{error === null ? null : (
					<p className="inline-error" role="alert" id="ag-reg-error">
						<Icon name={IconName.Alarm} size={16} />
						{error}
					</p>
				)}
			</form>
			<NextSteps wallet={wallet} />
		</main>
	);
};
