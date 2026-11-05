import "./push.css";
import { blockedHint } from "../shared";
import { PushState, usePush } from "./usePush";

const HINTS: Record<PushState, string> = {
	[PushState.Hidden]: "",
	[PushState.Off]:
		"Get a push on this device when a new job in your pairs appears.",
	[PushState.On]: "On for this device. A new job in your pairs sends a push.",
	[PushState.Blocked]: "",
};

// Wallet tab: the place to turn push off again (ADR 0029).
export const PushCard = () => {
	const { state, busy, error, toggle } = usePush();

	if (state === PushState.Hidden) {
		return null;
	}

	return (
		<section className="push" aria-labelledby="push-head">
			<h2 className="kicker" id="push-head">
				Notifications
			</h2>
			<p className="field__hint">
				{state === PushState.Blocked ? blockedHint() : HINTS[state]}
			</p>
			{state === PushState.Blocked ? null : (
				<button
					type="button"
					className={`btn btn--sm ${state === PushState.On ? "btn--ghost" : "btn--primary"}`}
					disabled={busy}
					onClick={() => void toggle()}
				>
					{state === PushState.On ? "Turn off" : "Turn on"}
				</button>
			)}
			{error === undefined ? null : <p className="error">{error}</p>}
		</section>
	);
};
