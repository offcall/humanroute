import "./install-hint.css";
import { useState } from "react";
import { getPhantom, Icon, IconName } from "../shared";

const DISMISS_KEY = "hr_install_hint_dismissed";

// iOS Safari only: other iOS browsers and Phantom have no "Add to Home Screen" (ADR 0034).
const isIosSafari = (): boolean => {
	const agent = navigator.userAgent;
	const ios =
		/iPhone|iPad|iPod/.test(agent) ||
		(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

	return ios && /Safari/.test(agent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(agent);
};

const isStandalone = (): boolean =>
	Reflect.get(navigator, "standalone") === true ||
	window.matchMedia("(display-mode: standalone)").matches;

const showHint = (): boolean =>
	isIosSafari() &&
	!isStandalone() &&
	getPhantom() === undefined &&
	localStorage.getItem(DISMISS_KEY) === null;

export const InstallHint = () => {
	const [shown, setShown] = useState(showHint);

	if (!shown) {
		return null;
	}

	const dismiss = () => {
		localStorage.setItem(DISMISS_KEY, "1");
		setShown(false);
	};

	return (
		<aside className="install-hint" aria-label="Add to Home Screen">
			<p>
				<b>Add HumanRoute to your Home Screen.</b> Tap Share, then Add to Home
				Screen. Open it from the icon: you stay signed in and get new-task
				alerts.
			</p>
			<button
				type="button"
				className="btn btn--text btn--sm"
				aria-label="Hide this hint"
				onClick={dismiss}
			>
				<Icon name={IconName.Cross} size={16} />
			</button>
		</aside>
	);
};
