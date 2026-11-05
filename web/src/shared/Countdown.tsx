import { formatLeft, toMs, useClock } from "./useClock";

type Props = { deadline: string | number; serverTime: string | number };

export const Countdown = ({ deadline, serverTime }: Props) => {
	const now = useClock(serverTime);

	return <span>{formatLeft(toMs(deadline) - now)}</span>;
};
