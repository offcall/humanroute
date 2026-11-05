import { Icon, IconName } from "../shared";
import { type JoinError, JoinFailure } from "./useJoin";

const NOT_FOUND = {
	title: "Invite not found",
	detail: "This link does not work. Ask your agency for a new invite link.",
};

const TEXTS: Record<JoinFailure, { title: string; detail: string }> = {
	[JoinFailure.NotFound]: NOT_FOUND,
	[JoinFailure.OtherAgency]: {
		title: "You already belong to another agency",
		detail:
			"One wallet joins one agency. Open your cabinet, or sign out and use another wallet.",
	},
	[JoinFailure.SignIn]: {
		title: "Sign-in failed:",
		detail:
			"Phantom did not sign the message. Press Sign in and join to try again.",
	},
	[JoinFailure.Other]: {
		title: "Could not join:",
		detail: "Check your connection and press Join again.",
	},
};

// Raw codes are shown only where the text names no cause of its own.
const WITH_CODE = [JoinFailure.SignIn, JoinFailure.Other];

export const JoinAlert = ({ error }: { error: JoinError | undefined }) => {
	const text = error === undefined ? NOT_FOUND : TEXTS[error.kind];

	return (
		<div className="alert alert--error" role="alert">
			<Icon name={IconName.Alarm} size={20} />
			<div>
				<b>{text.title}</b>
				{error !== undefined && WITH_CODE.includes(error.kind) ? (
					<>
						{" "}
						<code>{error.code}</code>
					</>
				) : null}
				<br />
				{text.detail}
			</div>
		</div>
	);
};
