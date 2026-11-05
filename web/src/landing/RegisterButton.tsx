import { Spinner } from "../shared";

type ButtonProps = {
	label: string;
	busyLabel: string | undefined;
	primary: boolean;
	locked: boolean;
	onClick: () => void;
};

export const RegisterButton = (props: ButtonProps) => {
	const isBusy = props.busyLabel !== undefined;
	const tone = props.primary ? "btn--primary" : "btn--ghost";

	return (
		<button
			type="button"
			className={`btn ${tone} land-btn`}
			disabled={props.locked && !isBusy}
			aria-busy={isBusy || undefined}
			aria-disabled={isBusy || undefined}
			onClick={isBusy ? undefined : props.onClick}
		>
			{isBusy ? <Spinner /> : null}
			<span className="land-btn__label">{props.busyLabel ?? props.label}</span>
		</button>
	);
};
