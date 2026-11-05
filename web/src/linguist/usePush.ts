import { useEffect, useState } from "react";
import {
	currentPush,
	fetchPushKey,
	pushAvailable,
	registerWorker,
	subscribePush,
	unsubscribePush,
} from "../shared";

export enum PushState {
	Hidden = "hidden",
	Off = "off",
	On = "on",
	Blocked = "blocked",
}

const stateOf = (subscription: PushSubscription | null): PushState => {
	if (Notification.permission === "denied") {
		return PushState.Blocked;
	}

	return subscription !== null && Notification.permission === "granted"
		? PushState.On
		: PushState.Off;
};

// Hidden when the server has no key, the browser has no Push, or iOS runs outside the home-screen icon.
export const usePush = () => {
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

	return { state, busy, error, toggle };
};
