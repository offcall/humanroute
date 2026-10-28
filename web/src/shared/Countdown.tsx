import { useEffect, useState } from "react";

type Props = { deadline: string | number; serverTime: string | number };

const toMs = (value: string | number): number =>
	typeof value === "number" ? value : Date.parse(value);

export const formatLeft = (leftMs: number): string => {
	if (!(leftMs > 0)) {
		return "expired";
	}
	const total = Math.ceil(leftMs / 1000);
	const seconds = String(total % 60).padStart(2, "0");

	return `${Math.floor(total / 60)}:${seconds}`;
};

export const Countdown = ({ deadline, serverTime }: Props) => {
	const [offset] = useState(() => toMs(serverTime) - Date.now());
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);

		return () => clearInterval(timer);
	}, []);

	return <span>{formatLeft(toMs(deadline) - (now + offset))}</span>;
};
