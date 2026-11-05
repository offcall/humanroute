import "./push.css";
import { PushState, usePush } from "./usePush";

// Top of the Board: asks once, disappears when push is on (ADR 0029).
export const BoardPush = () => {
	const { state, busy, error, toggle } = usePush();

	if (state === PushState.Blocked) {
		return (
			<p className="push-top__blocked">
				Notifications are blocked. To turn them on, remove the icon and add it
				to the Home Screen again.
			</p>
		);
	}
	if (state !== PushState.Off) {
		return null;
	}

	return (
		<aside className="push-top" aria-label="Notifications">
			<p>
				<b>Get new jobs instantly.</b> A push arrives when a job in your pairs
				appears.
			</p>
			<button
				type="button"
				className="btn btn--primary btn--sm"
				disabled={busy}
				onClick={() => void toggle()}
			>
				Turn on notifications
			</button>
			{error === undefined ? null : <p className="error">{error}</p>}
		</aside>
	);
};
