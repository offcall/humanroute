// Where Web Push works and what to say when it is blocked (ADR 0029).

// iPadOS reports itself as a Mac with touch.
const isIos = (): boolean =>
	/iPad|iPhone|iPod/.test(navigator.userAgent) ||
	(navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);

const isStandalone = (): boolean =>
	window.matchMedia("(display-mode: standalone)").matches ||
	("standalone" in navigator && navigator.standalone === true);

// iOS cannot ask again once denied; other browsers re-allow in their site settings.
export const blockedHint = (): string =>
	isIos()
		? "Notifications are blocked. To turn them on, remove the icon and add it to the Home Screen again."
		: "Notifications are blocked. Allow notifications for this site in your browser settings.";

// iOS delivers push only to the home-screen icon.
export const pushAvailable = (): boolean =>
	"serviceWorker" in navigator &&
	"PushManager" in window &&
	"Notification" in window &&
	(!isIos() || isStandalone());
