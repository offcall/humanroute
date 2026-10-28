import { useEffect, useRef } from "react";

const POLL_MS = 3000;

export const usePoll = (tick: () => void): void => {
	const latest = useRef(tick);
	latest.current = tick;

	useEffect(() => {
		const run = () => {
			if (!document.hidden) {
				latest.current();
			}
		};
		run();
		const timer = setInterval(run, POLL_MS);
		document.addEventListener("visibilitychange", run);

		return () => {
			clearInterval(timer);
			document.removeEventListener("visibilitychange", run);
		};
	}, []);
};
