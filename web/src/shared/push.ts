// Web Push in the browser (ADR 0029): the /sw.js worker, subscribe and unsubscribe.
import { request } from "./api";
import { isRecord, str } from "./parse";

const WORKER = "/sw.js";

const parseKey = (raw: unknown): { key: string | null } | undefined => {
	if (!isRecord(raw)) {
		return undefined;
	}
	const key = raw.publicKey === null ? null : str(raw.publicKey);

	return key === undefined ? undefined : { key };
};

const parseDone = (): true => true;

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

// null: push is off on the server, or the key could not be read.
export const fetchPushKey = async (): Promise<string | null> => {
	const res = await request("GET", "/api/push/key", undefined, parseKey);

	return res.ok ? res.value.key : null;
};

export const registerWorker = (): Promise<ServiceWorkerRegistration> =>
	navigator.serviceWorker.register(WORKER, { scope: "/" });

export const currentPush = async (): Promise<PushSubscription | null> => {
	const registration = await navigator.serviceWorker.getRegistration("/");

	return registration === undefined
		? null
		: registration.pushManager.getSubscription();
};

const keyBytes = (base64url: string): Uint8Array<ArrayBuffer> => {
	const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));

	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

// Call from a tap: iOS asks for permission only inside a user gesture.
export const subscribePush = async (publicKey: string): Promise<boolean> => {
	const permission = await Notification.requestPermission();
	if (permission !== "granted") {
		return false;
	}
	const registration = await registerWorker();
	await navigator.serviceWorker.ready;
	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: keyBytes(publicKey),
	});
	const res = await request(
		"POST",
		"/api/push/subscribe",
		subscription.toJSON(),
		parseDone,
	);
	if (!res.ok) {
		await subscription.unsubscribe();
	}

	return res.ok;
};

// Re-sends this device's subscription, so the server row exists and belongs to this linguist
// (upsert by endpoint). Best effort: request never throws and the answer is ignored.
export const resyncPush = async (
	subscription: PushSubscription,
): Promise<void> => {
	await request(
		"POST",
		"/api/push/subscribe",
		subscription.toJSON(),
		parseDone,
	);
};

// Best effort: never throws.
export const unsubscribePush = async (): Promise<void> => {
	try {
		const subscription = await currentPush();
		if (subscription === null) {
			return;
		}
		const { endpoint } = subscription;
		await subscription.unsubscribe();
		await request("POST", "/api/push/unsubscribe", { endpoint }, parseDone);
	} catch {
		return;
	}
};
