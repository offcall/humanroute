import { useMemo, useSyncExternalStore } from "react";

// One 1 s ticker for every countdown on screen; it runs only while someone listens.
const listeners = new Set<() => void>();
let tick = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	if (timer === undefined) {
		tick = Date.now();
		timer = setInterval(() => {
			tick = Date.now();
			for (const notify of listeners) {
				notify();
			}
		}, 1000);
	}

	return () => {
		listeners.delete(listener);
		if (listeners.size === 0 && timer !== undefined) {
			clearInterval(timer);
			timer = undefined;
		}
	};
};

const snapshot = () => tick;

export const toMs = (value: string | number): number =>
	typeof value === "number" ? value : Date.parse(value);

// Server "now" in ms: the shared tick plus the offset from the latest serverTime.
export const useClock = (serverTime?: string | number): number => {
	const local = useSyncExternalStore(subscribe, snapshot);
	const offset = useMemo(
		() => (serverTime === undefined ? 0 : toMs(serverTime) - Date.now()),
		[serverTime],
	);

	return local + offset;
};

// "m:ss", rounded up; 0:00 once the deadline passed
export const formatLeft = (leftMs: number): string => {
	const total = leftMs > 0 ? Math.ceil(leftMs / 1000) : 0;
	const seconds = String(total % 60).padStart(2, "0");

	return `${Math.floor(total / 60)}:${seconds}`;
};

// Local wall-clock time "10:14:03"
export const formatClock = (value: string | number): string =>
	new Date(toMs(value)).toLocaleTimeString("en-GB", { hour12: false });
