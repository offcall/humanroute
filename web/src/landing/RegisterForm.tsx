import "./form.css";
import { useState } from "react";
import { Icon, IconName } from "../shared";
import { LandAlert } from "./LandAlert";
import { RegisterButton } from "./RegisterButton";
import { hintText, statusText } from "./texts";
import { Busy, Failure, type LandError } from "./useRegister";

type Props = {
	busy: Busy;
	error: LandError | undefined;
	wallet: string | undefined;
	onFirm: (name: string) => void;
	onAgency: () => void;
};

const BUSY_LABELS: Partial<Record<Busy, string>> = {
	[Busy.SignFirm]: "Signing…",
	[Busy.RegisterFirm]: "Registering…",
};

export const RegisterForm = ({
	busy,
	error,
	wallet,
	onFirm,
	onAgency,
}: Props) => {
	const [name, setName] = useState("My firm");
	const locked = busy !== Busy.Idle;
	const noWallet = error?.kind === Failure.NoWallet;
	const firmBusy = BUSY_LABELS[busy];
	const alert = error === undefined ? null : <LandAlert error={error} />;

	return (
		<form
			className="panel land-form"
			aria-label="Register"
			onSubmit={(event) => event.preventDefault()}
		>
			<div className="field">
				<label className="field__label" htmlFor="firm-name">
					Firm name
				</label>
				<input
					className="input"
					id="firm-name"
					name="firmName"
					autoComplete="organization"
					value={name}
					disabled={locked}
					onChange={(event) => setName(event.target.value)}
				/>
			</div>
			{noWallet ? alert : null}
			<div className="land-actions">
				<RegisterButton
					label="Register firm"
					busyLabel={firmBusy}
					primary={!noWallet}
					locked={locked}
					onClick={() => onFirm(name)}
				/>
				<RegisterButton
					label="Register agency"
					busyLabel={busy === Busy.SignAgency ? "Signing…" : undefined}
					primary={false}
					locked={locked}
					onClick={onAgency}
				/>
			</div>
			{locked ? (
				<p className="land-status" role="status">
					<Icon name={IconName.Clock} size={18} />
					{statusText(busy, name.trim() || "My firm")}
				</p>
			) : null}
			{noWallet ? null : alert}
			<p className="land-hint">{hintText(busy, wallet)}</p>
		</form>
	);
};
