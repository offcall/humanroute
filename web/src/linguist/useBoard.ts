import { useCallback, useEffect, useState } from "react";
import { parseBoard, request, toMs, usePoll } from "../shared";
import {
	applyLatest,
	firstSnapshot,
	hasOpen,
	markTaken,
	newCount,
	type Snapshot,
	withLatest,
} from "./boardSnapshot";

export type BoardState = {
	snap: Snapshot | undefined;
	serverTime: string | undefined;
	loadError: string | undefined;
	fresh: number;
	// apply: the loaded list replaces the shown one
	refresh: (apply: boolean) => Promise<void>;
	show: () => void;
	lose: (taskId: string) => void;
};

// Polled in the shell, so the Board tab badge counts new jobs on every tab.
export const useBoard = (): BoardState => {
	const [snap, setSnap] = useState<Snapshot>();
	const [serverTime, setServerTime] = useState<string>();
	const [loadError, setLoadError] = useState<string>();

	const refresh = useCallback(async (apply: boolean) => {
		const res = await request("GET", "/api/board", undefined, parseBoard);
		if (!res.ok) {
			setLoadError(res.error.message ?? res.error.error);
			return;
		}
		const { tasks } = res.value;
		const serverMs = toMs(res.value.serverTime);
		setServerTime(res.value.serverTime);
		setLoadError(undefined);
		setSnap((prev) => {
			if (prev === undefined) {
				return firstSnapshot(tasks, serverMs);
			}
			const next = withLatest(prev, tasks, serverMs);

			return apply || !hasOpen(next, serverMs) ? applyLatest(next) : next;
		});
	}, []);

	usePoll(() => void refresh(false));

	// Back to the app (also opened from a push): show the latest list at once.
	useEffect(() => {
		const onVisible = () => {
			if (document.visibilityState === "visible") {
				void refresh(true);
			}
		};
		document.addEventListener("visibilitychange", onVisible);

		return () => document.removeEventListener("visibilitychange", onVisible);
	}, [refresh]);

	const show = () => setSnap((prev) => prev && applyLatest(prev));
	const lose = (taskId: string) =>
		setSnap((prev) => prev && markTaken(prev, taskId));

	return {
		snap,
		serverTime,
		loadError,
		fresh: snap === undefined ? 0 : newCount(snap),
		refresh,
		show,
		lose,
	};
};
