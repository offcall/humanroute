import { Icon, IconName, Spinner } from "../shared";
import { JoinBusy } from "./useJoin";

type Props = {
	signedIn: boolean;
	busy: JoinBusy;
	onJoin: () => void;
	// 409: the main action is Open my cabinet, Join drops to an outline pill
	demoted?: boolean;
	retry?: boolean;
};

const BUSY_LABELS: Record<JoinBusy, string> = {
	[JoinBusy.Idle]: "",
	[JoinBusy.SignIn]: "Signing in…",
	[JoinBusy.Join]: "Joining…",
};

export const JoinButton = ({
	signedIn,
	busy,
	onJoin,
	demoted = false,
	retry = false,
}: Props) => {
	const isBusy = busy !== JoinBusy.Idle;
	const idleLabel = signedIn ? "Join" : "Sign in and join";
	const tone = demoted
		? "btn btn--outline-white btn--sm btn--block"
		: "btn btn--white btn--block";

	return (
		<button
			type="button"
			className={tone}
			aria-busy={isBusy || undefined}
			aria-disabled={isBusy || undefined}
			onClick={isBusy ? undefined : onJoin}
		>
			{isBusy ? <Spinner /> : null}
			{retry && !isBusy ? <Icon name={IconName.Refresh} size={18} /> : null}
			{isBusy ? BUSY_LABELS[busy] : idleLabel}
		</button>
	);
};
