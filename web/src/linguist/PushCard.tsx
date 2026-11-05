import { useEffect, useState } from "react";
import {
	currentPush,
	fetchPushKey,
	pushAvailable,
	registerWorker,
	subscribePush,
	unsubscribePush,
} from "../shared";
import "./push.css";

enum PushState {
	Hidden = "hidden",
	Off = "off",
	On = "on",
	Blocked = "blocked",
}

const HINTS: Record<PushState, string> = {
	[PushState.Hidden]: "",
	[PushState.Off]:
		"Get a push on this device when a new job in your pairs appears.",
	[PushState.On]: "On for this device. A new job in your pairs sends a push.",
	[PushState.Blocked]:
		"Blocked in the settings for this site. Allow notifications there to turn them on.",
};

const stateOf = (subscription: PushSubscription | null): PushState => {
	if (Notification.permission === "denied") {
		return PushState.Blocked;
	}

	return subscription !== null && Notification.permission === "granted"
		? PushState.On
		: PushState.Off;
};

// Hidden when the server has no key, the browser has no Push, or iOS runs outside the home-screen icon.
export const PushCard = () => {
	const [publicKey, setPublicKey] = useState<string | null>(null);
	const [state, setState] = useState(PushState.Hidden);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);

	useEffect(() => {
		if (!pushAvailable()) {
			return;
		}
		let live = true;
		const detect = async () => {
			const key = await fetchPushKey();
			if (key === null) {
				return;
			}
			await registerWorker();
			const subscription = await currentPush();
			if (live) {
				setPublicKey(key);
				setState(stateOf(subscription));
			}
		};
		detect().catch(() => undefined);

		return () => {
			live = false;
		};
	}, []);

	// Permission is asked only here, on a tap.
	const toggle = async () => {
		if (publicKey === null) {
			return;
		}
		setBusy(true);
		setError(undefined);
		try {
			if (state === PushState.On) {
				await unsubscribePush();
			} else if (!(await subscribePush(publicKey))) {
				setError(
					Notification.permission === "granted"
						? "Could not turn on notifications. Try again."
						: undefined,
				);
			}
			setState(stateOf(await currentPush()));
		} catch {
			setError("Could not change notifications. Try again.");
		}
		setBusy(false);
	};

	if (state === PushState.Hidden) {
		return null;
	}

	return (
		<section className="push" aria-labelledby="push-head">
			<h2 className="kicker" id="push-head">
				Notifications
			</h2>
			<p className="field__hint">{HINTS[state]}</p>
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
